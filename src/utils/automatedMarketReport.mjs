import fs from 'node:fs';
import path from 'node:path';

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'tipo', 'un', 'und',
  'unidade', 'unidades', 'kg', 'g', 'gr', 'ml', 'l', 'lt', 'litro', 'litros'
]);

const normalize = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stem = token => token.length > 4 ? token.replace(/(oes|aes|ais|eis|is|os|as|es|s)$/u, '') : token;
const tokens = value => normalize(value).split(' ').filter(token => token && !STOP_WORDS.has(token)).map(stem);

function parsePackage(value) {
  const text = normalize(value).replace(/(\d)\s*,\s*(\d)/g, '$1.$2');
  const match = text.match(/(?:c\s*\/\s*)?(\d+(?:\.\d+)?)\s*(kg|g|gr|l|lt|ml|un|und|unid|unidade|unidades)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === 'kg') return { kind: 'weight', amount: amount * 1000, label: 'kg' };
  if (unit === 'g' || unit === 'gr') return { kind: 'weight', amount, label: 'kg' };
  if (unit === 'l' || unit === 'lt') return { kind: 'volume', amount: amount * 1000, label: 'L' };
  if (unit === 'ml') return { kind: 'volume', amount, label: 'L' };
  return { kind: 'count', amount, label: 'un' };
}

function comparablePrice(product) {
  const pack = parsePackage(`${product.name} ${product.unit || ''}`);
  if (!pack) return { value: Number(product.price), label: null, kind: null };
  const base = pack.kind === 'count' ? 1 : 1000;
  return {
    value: Number(product.price) * base / pack.amount,
    label: `${formatMoney(Number(product.price) * base / pack.amount)}/${pack.label}`,
    kind: pack.kind
  };
}

function matchScore(query, product) {
  const queryTokens = tokens(query);
  const productTokens = new Set(tokens(`${product.name} ${product.category || ''}`));
  if (!queryTokens.length || !productTokens.size) return 0;
  if (!productTokens.has(queryTokens[0])) return 0;
  const matches = queryTokens.filter(token => productTokens.has(token)).length;
  const score = matches / queryTokens.length;
  const queryPack = parsePackage(query);
  const productPack = parsePackage(`${product.name} ${product.unit || ''}`);
  if (queryPack && productPack && queryPack.kind !== productPack.kind) return 0;
  if (queryPack && productPack && Math.abs(queryPack.amount - productPack.amount) > 0.001) return 0;
  return score;
}

function isActiveOffer(product, now) {
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) return false;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  return (!product.startDate || product.startDate <= today) && (!product.endDate || product.endDate >= today);
}

function resolvePrice(product, specialMarkets) {
  const special = specialMarkets.has(normalize(product.market));
  if (special && Number.isFinite(Number(product.specialPrice))) {
    return { ...product, price: Number(product.specialPrice), priceTier: 'special' };
  }
  if (product.specialOnly && !special) return null;
  if (Number.isFinite(Number(product.regularPrice))) return { ...product, price: Number(product.regularPrice) };
  return product;
}

function chooseBestOffer(query, products) {
  return products
    .map(product => ({ product, score: matchScore(query, product), value: comparablePrice(product) }))
    .filter(candidate => candidate.score >= 0.5)
    .sort((a, b) => a.value.value - b.value.value || b.score - a.score || Number(a.product.price) - Number(b.product.price))[0] || null;
}

export function buildAutomatedMarketReport({ products, shoppingList, specialMarkets = [], city = 'Ourinhos', now = new Date() }) {
  const specialMarketSet = new Set(specialMarkets.map(normalize));
  const activeProducts = products
    .filter(product => city === 'Todas' || product.city === city)
    .filter(product => isActiveOffer(product, now))
    .map(product => resolvePrice(product, specialMarketSet))
    .filter(Boolean);

  const rows = shoppingList.map(item => {
    const best = chooseBestOffer(item.name, activeProducts);
    if (!best) return { item, offer: null };
    return {
      item,
      offer: best.product,
      valueLabel: best.value.label,
      subtotal: Number(best.product.price) * Number(item.quantity || 1)
    };
  });
  const found = rows.filter(row => row.offer);
  const grouped = found.reduce((markets, row) => {
    const market = row.offer.market || 'Mercado não informado';
    (markets[market] ||= []).push(row);
    return markets;
  }, {});
  return {
    city,
    generatedAt: now,
    rows,
    grouped,
    foundCount: found.length,
    missingCount: rows.length - found.length,
    total: found.reduce((sum, row) => sum + row.subtotal, 0)
  };
}

export const formatMoney = value => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderAutomatedMarketReportHtml(report) {
  const generated = report.generatedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const marketSections = Object.entries(report.grouped).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([market, rows]) => {
    const subtotal = rows.reduce((sum, row) => sum + row.subtotal, 0);
    return `<h2>${escapeHtml(market)}</h2><table><thead><tr><th>Item da lista</th><th>Melhor oferta</th><th>Qtd.</th><th>Preço</th><th>R$/Base</th><th>Subtotal</th><th>Validade</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.item.name)}</td><td>${escapeHtml(row.offer.name)}</td><td>${escapeHtml(row.item.quantity)}</td><td>${formatMoney(row.offer.price)}</td><td>${escapeHtml(row.valueLabel || '-')}</td><td>${formatMoney(row.subtotal)}</td><td>${escapeHtml(row.offer.endDate || '-')}</td></tr>`).join('')}<tr class="subtotal"><td colspan="5">Subtotal ${escapeHtml(market)}</td><td>${formatMoney(subtotal)}</td><td></td></tr></tbody></table>`;
  }).join('');
  const missing = report.rows.filter(row => !row.offer).map(row => `<li>${escapeHtml(row.item.name)}</li>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#17202a;font-size:11px}h1{color:#146c43;margin-bottom:4px}h2{margin:22px 0 6px;color:#146c43}.meta{color:#59636e;margin-bottom:16px}.summary{display:flex;gap:12px}.box{border:1px solid #ccd4da;border-radius:8px;padding:10px 14px}.box strong{display:block;font-size:18px;color:#146c43}table{width:100%;border-collapse:collapse;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{border:1px solid #d8dee3;padding:6px;text-align:left}th{background:#eaf6ef}.subtotal td{font-weight:bold;background:#f4f7f5}footer{margin-top:20px;color:#667}</style></head><body><h1>Melhores preços por mercado</h1><div class="meta">${escapeHtml(report.city)} · Gerado em ${escapeHtml(generated)} · Lista salva no Radar de Preços</div><div class="summary"><div class="box">Total otimizado<strong>${formatMoney(report.total)}</strong></div><div class="box">Itens encontrados<strong>${report.foundCount}</strong></div><div class="box">Itens sem preço<strong>${report.missingCount}</strong></div></div>${marketSections}${missing ? `<h2>Itens sem oferta encontrada</h2><ul>${missing}</ul>` : ''}<footer>Os valores consideram apenas ofertas válidas disponíveis no catálogo no momento da geração.</footer></body></html>`;
}

export async function saveReportPdf(browser, html, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.pdf({ path: outputPath, format: 'A4', landscape: true, printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
  } finally {
    await page.close();
  }
}
