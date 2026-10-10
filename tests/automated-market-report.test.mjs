import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomatedMarketReport, renderAutomatedMarketReportHtml } from '../src/utils/automatedMarketReport.mjs';

const now = new Date('2026-10-10T15:00:00-03:00');

test('groups the cheapest matching offers by market', () => {
  const report = buildAutomatedMarketReport({
    now,
    city: 'Ourinhos',
    shoppingList: [
      { id: '1', name: 'Arroz tipo 1 5kg', quantity: 2 },
      { id: '2', name: 'Feijão carioca 1kg', quantity: 1 }
    ],
    products: [
      { id: 'a', name: 'Arroz Tipo 1 5kg', price: 25, market: 'Mercado A', city: 'Ourinhos', endDate: '2026-10-11' },
      { id: 'b', name: 'Arroz Tipo 1 5kg', price: 22, market: 'Mercado B', city: 'Ourinhos', endDate: '2026-10-11' },
      { id: 'c', name: 'Feijão Carioca 1kg', price: 7.5, market: 'Mercado A', city: 'Ourinhos', endDate: '2026-10-11' }
    ]
  });

  assert.equal(report.foundCount, 2);
  assert.equal(report.total, 51.5);
  assert.equal(report.grouped['Mercado B'][0].offer.id, 'b');
  assert.match(renderAutomatedMarketReportHtml(report), /Melhores preços por mercado/);
});

test('ignores expired offers and respects customer-only prices', () => {
  const base = {
    now,
    city: 'Ourinhos',
    shoppingList: [{ id: '1', name: 'Leite integral 1L', quantity: 1 }],
    products: [
      { id: 'expired', name: 'Leite Integral 1L', price: 1, market: 'Mercado A', city: 'Ourinhos', endDate: '2026-10-09' },
      { id: 'club', name: 'Leite Integral 1L', price: 6, regularPrice: 6, specialPrice: 4, market: 'Mercado B', city: 'Ourinhos', endDate: '2026-10-11' }
    ]
  };
  assert.equal(buildAutomatedMarketReport(base).total, 6);
  assert.equal(buildAutomatedMarketReport({ ...base, specialMarkets: ['Mercado B'] }).total, 4);
});

test('still produces a report when no current offer is available', () => {
  const report = buildAutomatedMarketReport({
    now,
    city: 'Ourinhos',
    shoppingList: [{ id: '1', name: 'Arroz 5kg', quantity: 1 }],
    products: []
  });
  assert.equal(report.foundCount, 0);
  assert.equal(report.missingCount, 1);
  assert.match(renderAutomatedMarketReportHtml(report), /Itens sem oferta encontrada/);
});
