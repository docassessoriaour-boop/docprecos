import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  ShoppingCart, 
  TrendingDown, 
  CheckCircle, 
  Info,
  Key,
  Eye,
  EyeOff,
  Calendar,
  Globe,
  Link as LinkIcon,
  Image as ImageIcon,
  Pencil
} from 'lucide-react';
import type { Product, ShoppingItem, MarketComparison, OptimizedItem } from './types';
import { extractTextFromPDF } from './utils/pdfParser';
import { extractOffersWithGemini, extractOffersFallback, generateDemoOffers, fetchHtmlFromUrl, extractOffersFromImage, extractOffersFromPDFFile, searchOffersOnline, parseInformalShoppingList } from './utils/geminiExtractor';
import defaultProductsData from './data/defaultProducts.json';
import './App.css';

// Initial Mock Data configured for Ourinhos
const INITIAL_PRODUCTS: Product[] = [
  // Supermercado Bom Preço (Ourinhos)
  { id: '1', name: 'Arroz Tio João Tipo 1 5kg', price: 24.90, category: 'Mercearia', unit: '5kg', market: 'Bom Preço', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '2', name: 'Feijão Carioca Camil 1kg', price: 6.89, category: 'Mercearia', unit: '1kg', market: 'Bom Preço', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '3', name: 'Leite Integral Piracanjuba 1L', price: 4.89, category: 'Frios e Laticínios', unit: '1L', market: 'Bom Preço', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-15' }, // Expired
  { id: '4', name: 'Alcatra Bovina kg', price: 39.90, category: 'Açougue', unit: 'kg', market: 'Bom Preço', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '5', name: 'Cerveja Heineken Lata 350ml', price: 4.99, category: 'Bebidas', unit: '350ml', market: 'Bom Preço', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '6', name: 'Detergente Ipê Neutro 500ml', price: 2.19, category: 'Limpeza', unit: '500ml', market: 'Bom Preço', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  
  // Supermercado Extra Baratão (Ourinhos)
  { id: '8', name: 'Arroz Tio João Tipo 1 5kg', price: 23.50, category: 'Mercearia', unit: '5kg', market: 'Extra Baratão', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '9', name: 'Feijão Carioca Camil 1kg', price: 7.20, category: 'Mercearia', unit: '1kg', market: 'Extra Baratão', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '10', name: 'Leite Integral Piracanjuba 1L', price: 4.49, category: 'Frios e Laticínios', unit: '1L', market: 'Extra Baratão', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '11', name: 'Alcatra Bovina kg', price: 42.50, category: 'Açougue', unit: 'kg', market: 'Extra Baratão', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  
  // Supermercado Compre Bem (Ourinhos)
  { id: '15', name: 'Arroz Tio João Tipo 1 5kg', price: 25.90, category: 'Mercearia', unit: '5kg', market: 'Compre Bem', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '16', name: 'Feijão Carioca Camil 1kg', price: 6.30, category: 'Mercearia', unit: '1kg', market: 'Compre Bem', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
  { id: '18', name: 'Alcatra Bovina kg', price: 37.90, category: 'Açougue', unit: 'kg', market: 'Compre Bem', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-17' }, // Expiring soon (ends tomorrow 17)
  { id: '20', name: 'Detergente Ipê Neutro 500ml', price: 1.99, category: 'Limpeza', unit: '500ml', market: 'Compre Bem', city: 'Ourinhos', startDate: '2026-07-10', endDate: '2026-07-24' },
];

const LEGACY_DEMO_PRODUCT_IDS = new Set(INITIAL_PRODUCTS.map(product => product.id));

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const getTodayDateOnly = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const isDateExpired = (value?: string) => {
  const endDate = parseDateOnly(value);
  return endDate ? endDate < getTodayDateOnly() : false;
};

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getProductImportYear = (product: Product) => {
  const timestampMatch = product.id.match(/-(\d{13})-/);
  if (!timestampMatch) return null;

  const timestampDate = new Date(Number(timestampMatch[1]));
  const year = timestampDate.getFullYear();
  return Number.isFinite(year) ? year : null;
};

const normalizeOfferDateYear = (value: string | undefined, product: Product) => {
  const date = parseDateOnly(value);
  if (!date) return value;

  const importYear = getProductImportYear(product);
  if (!importYear || date.getFullYear() >= importYear) return value;

  return formatDateOnly(new Date(importYear, date.getMonth(), date.getDate()));
};

const normalizeProductOfferDates = (product: Product): Product => ({
  ...product,
  startDate: normalizeOfferDateYear(product.startDate, product),
  endDate: normalizeOfferDateYear(product.endDate, product)
});

const normalizeProductsOfferDates = (products: Product[]) =>
  products.map(normalizeProductOfferDates);

const normalizeDuplicateKeyText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatProductPriceForKey = (price: number) =>
  Number.isFinite(price) ? price.toFixed(2) : String(price);

const getProductDuplicateKey = (product: Product) => [
  normalizeDuplicateKeyText(product.city),
  normalizeDuplicateKeyText(product.market),
  normalizeDuplicateKeyText(product.name),
  formatProductPriceForKey(product.price),
  product.endDate || ''
].join('|');

const getShoppingItemDuplicateKey = (item: Pick<ShoppingItem, 'name'>) => {
  const searchableName = getSearchTokens(item.name).join(' ');
  return searchableName || normalizeDuplicateKeyText(item.name);
};

const consolidateShoppingItems = (items: ShoppingItem[]) => {
  const itemMap = new Map<string, ShoppingItem>();

  items.forEach(item => {
    const key = getShoppingItemDuplicateKey(item);
    const existing = itemMap.get(key);

    if (existing) {
      itemMap.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity
      });
      return;
    }

    itemMap.set(key, item);
  });

  return Array.from(itemMap.values());
};

type MarketComparisonItem = MarketComparison['items'][number];

const getComparisonItemMergeKey = (item: MarketComparisonItem) => {
  if (!item.found) return `missing|${getShoppingItemDuplicateKey({ name: item.itemName })}`;

  return [
    'found',
    normalizeDuplicateKeyText(item.catalogName || item.itemName),
    formatProductPriceForKey(item.price)
  ].join('|');
};

const mergeRepeatedComparisonItems = (items: MarketComparisonItem[]) => {
  const merged = new Map<string, MarketComparisonItem>();

  items.forEach(item => {
    const key = getComparisonItemMergeKey(item);
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        subtotal: existing.subtotal + item.subtotal
      });
      return;
    }

    merged.set(key, { ...item });
  });

  return Array.from(merged.values());
};

const getOptimizedItemMergeKey = (item: OptimizedItem) => {
  if (item.market === 'Não encontrado') return `missing|${getShoppingItemDuplicateKey({ name: item.name })}`;

  return [
    'found',
    normalizeDuplicateKeyText(item.city),
    normalizeDuplicateKeyText(item.market),
    item.offerId || normalizeDuplicateKeyText(item.catalogName || item.name),
    formatProductPriceForKey(item.price),
    item.endDate || ''
  ].join('|');
};

const mergeRepeatedOptimizedItems = (items: OptimizedItem[]) => {
  const merged = new Map<string, OptimizedItem>();

  items.forEach(item => {
    const key = getOptimizedItemMergeKey(item);
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        subtotal: existing.subtotal + item.subtotal,
        selectedManually: existing.selectedManually || item.selectedManually
      });
      return;
    }

    merged.set(key, { ...item });
  });

  return Array.from(merged.values());
};

const removeDuplicateProducts = (products: Product[]) => {
  const seenKeys = new Set<string>();

  return products.filter(product => {
    const key = getProductDuplicateKey(product);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
};

const removeExpiredProducts = (products: Product[]) =>
  removeDuplicateProducts(
    normalizeProductsOfferDates(products).filter(product => !isDateExpired(product.endDate))
  );

const DEFAULT_PRODUCTS = removeExpiredProducts(defaultProductsData as Product[]);

const loadSavedProducts = () => {
  const saved = localStorage.getItem('products_list');
  if (!saved) return DEFAULT_PRODUCTS;

  try {
    const savedProducts = JSON.parse(saved) as Product[];
    if (savedProducts.length === 0) return DEFAULT_PRODUCTS;

    const containsOnlyLegacyDemo =
      savedProducts.length > 0 &&
      savedProducts.every(product => LEGACY_DEMO_PRODUCT_IDS.has(product.id));

    if (containsOnlyLegacyDemo) {
      localStorage.removeItem('products_list');
      return DEFAULT_PRODUCTS;
    }

    return removeExpiredProducts(savedProducts);
  } catch {
    localStorage.removeItem('products_list');
    return DEFAULT_PRODUCTS;
  }
};

const SEARCH_STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'para', 'por', 'tipo',
  'un', 'unidade', 'kg', 'g', 'l', 'ml', 'litro', 'litros', 'pacote', 'pct'
]);

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getDaysUntilDate = (value?: string) => {
  const endDate = parseDateOnly(value);
  if (!endDate) return null;
  return Math.round((endDate.getTime() - getTodayDateOnly().getTime()) / MS_PER_DAY);
};

const getSearchTokens = (value: string) =>
  normalizeSearchText(value)
    .split(' ')
    .filter(token => token.length > 1 && !SEARCH_STOP_WORDS.has(token));

type ProductFamily =
  | 'rice'
  | 'beans'
  | 'sugar'
  | 'oil'
  | 'coffee'
  | 'pasta'
  | 'flour'
  | 'biscuit'
  | 'soda'
  | 'water_mineral'
  | 'coconut_water'
  | 'beer'
  | 'milk_uht'
  | 'milk_condensed'
  | 'milk_cream'
  | 'milk_powder'
  | 'milk_coconut'
  | 'milk_sweet'
  | 'chocolate_milk'
  | 'dairy_drink'
  | 'laundry_bar'
  | 'laundry_powder'
  | 'dish_detergent'
  | 'toilet_paper'
  | 'paper_towel'
  | 'diaper'
  | 'shampoo'
  | 'soap'
  | 'toothpaste'
  | 'softener'
  | 'disinfectant'
  | 'bleach'
  | 'steel_wool'
  | 'cleaning_sponge'
  | 'alcohol'
  | 'air_freshener'
  | 'kerosene'
  | 'aluminum_cleaner'
  | 'pet_food'
  | 'unknown';

type ProductAttribute =
  | 'integral'
  | 'semidesnatado'
  | 'desnatado'
  | 'zero_lactose'
  | 'traditional'
  | 'zero'
  | 'light'
  | 'diet';

type ProductPackageKind = 'weight' | 'volume' | 'count';

interface ProductPackageInfo {
  kind: ProductPackageKind;
  amount: number;
  unit: 'g' | 'kg' | 'ml' | 'l' | 'un';
  normalizedAmount: number;
  label: string;
}

interface ProductSearchProfile {
  family: ProductFamily;
  attributes: Set<ProductAttribute>;
  packageInfo: ProductPackageInfo | null;
  subtype: string | null;
}

interface WhatsAppCollectorConfig {
  ownerWhatsAppNumber: string;
  monitoredMarkets: {
    market: string;
    phones: string[];
  }[];
  offersInboxFolder: string;
  receivedWhatsAppFolder: string;
}

interface ClientPreList {
  id: string;
  clientName: string;
  listName: string;
  city: string;
  items: ShoppingItem[];
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CLIENT_PRE_LISTS_VERSION = '2026-08-04-vovo-nena-completa';

const DEFAULT_VOVO_NENA_PRE_LIST: ClientPreList = {
  id: 'default-vovo-nena-lista-mercado-2026-08-04',
  clientName: 'Vovó Nena',
  listName: 'Vovó Nena',
  city: 'Ourinhos',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
  items: [
    { id: 'vovo-nena-000', name: 'ABACATE kg', quantity: 1 },
    { id: 'vovo-nena-001', name: 'ABACAXI kg', quantity: 1 },
    { id: 'vovo-nena-002', name: 'Abobora Cabotia kg', quantity: 1 },
    { id: 'vovo-nena-003', name: 'ABÓBORA PAULISTA kg', quantity: 1 },
    { id: 'vovo-nena-004', name: 'Abobrinha kg', quantity: 1 },
    { id: 'vovo-nena-005', name: 'Acelga kg', quantity: 1 },
    { id: 'vovo-nena-006', name: 'Alho Descascado kg', quantity: 1 },
    { id: 'vovo-nena-007', name: 'ALMEIRÃO kg', quantity: 1 },
    { id: 'vovo-nena-008', name: 'Banana Maçã kg', quantity: 1 },
    { id: 'vovo-nena-009', name: 'BANANA NANICA kg', quantity: 1 },
    { id: 'vovo-nena-010', name: 'BATATA DOCE kg', quantity: 1 },
    { id: 'vovo-nena-011', name: 'Batata Inglesa kg', quantity: 1 },
    { id: 'vovo-nena-012', name: 'BERINJELA kg', quantity: 1 },
    { id: 'vovo-nena-013', name: 'BETERRABA kg', quantity: 1 },
    { id: 'vovo-nena-014', name: 'BRÓCOLIS kg', quantity: 1 },
    { id: 'vovo-nena-015', name: 'Cebola kg', quantity: 1 },
    { id: 'vovo-nena-016', name: 'Cenoura kg', quantity: 1 },
    { id: 'vovo-nena-017', name: 'Cheiro Verde kg', quantity: 1 },
    { id: 'vovo-nena-018', name: 'CHICÓRIA kg', quantity: 1 },
    { id: 'vovo-nena-019', name: 'Chuchu kg', quantity: 1 },
    { id: 'vovo-nena-020', name: 'COUVE kg', quantity: 1 },
    { id: 'vovo-nena-021', name: 'Espinafre kg', quantity: 1 },
    { id: 'vovo-nena-022', name: 'Laranja Pera kg', quantity: 1 },
    { id: 'vovo-nena-023', name: 'Limão kg', quantity: 1 },
    { id: 'vovo-nena-024', name: 'Maçã kg', quantity: 1 },
    { id: 'vovo-nena-025', name: 'Mamão kg', quantity: 1 },
    { id: 'vovo-nena-026', name: 'Mandioquinha Salsa kg', quantity: 1 },
    { id: 'vovo-nena-027', name: 'Manga kg', quantity: 1 },
    { id: 'vovo-nena-028', name: 'Melancia kg', quantity: 1 },
    { id: 'vovo-nena-029', name: 'MILHO VERDE kg', quantity: 1 },
    { id: 'vovo-nena-030', name: 'Morango kg', quantity: 1 },
    { id: 'vovo-nena-031', name: 'Ovos kg', quantity: 1 },
    { id: 'vovo-nena-032', name: 'PEPINO kg', quantity: 1 },
    { id: 'vovo-nena-033', name: 'PÊRA kg', quantity: 1 },
    { id: 'vovo-nena-034', name: 'Repolho kg', quantity: 1 },
    { id: 'vovo-nena-035', name: 'Tomate kg', quantity: 1 },
    { id: 'vovo-nena-036', name: 'Vagem kg', quantity: 1 },
    { id: 'vovo-nena-037', name: 'AGUA SANITARIA', quantity: 1 },
    { id: 'vovo-nena-038', name: 'ALCOOL', quantity: 1 },
    { id: 'vovo-nena-039', name: 'AMACIANTE DE ROUPA', quantity: 1 },
    { id: 'vovo-nena-040', name: 'DETERGENTE', quantity: 1 },
    { id: 'vovo-nena-041', name: 'ESPONJA DUPLA FACE', quantity: 1 },
    { id: 'vovo-nena-042', name: 'LIMPA ALUMINIO', quantity: 1 },
    { id: 'vovo-nena-043', name: 'ODORISADOR DE AR', quantity: 1 },
    { id: 'vovo-nena-044', name: 'PAPEL HIGIENCIO COM 12 OU MAIS ROLOS POR PACOTE', quantity: 1 },
    { id: 'vovo-nena-045', name: 'QUEROSENE', quantity: 1 },
    { id: 'vovo-nena-046', name: 'SABÃO EM PEDRA', quantity: 1 },
    { id: 'vovo-nena-047', name: 'SABAO EM PÓ', quantity: 1 },
    { id: 'vovo-nena-048', name: 'AMIDO DE MILHO', quantity: 1 },
    { id: 'vovo-nena-049', name: 'ARROZ 5KG', quantity: 1 },
    { id: 'vovo-nena-050', name: 'AVEIA EM FLOCOS FINOS', quantity: 1 },
    { id: 'vovo-nena-051', name: 'BISCOITO DE MAISENA', quantity: 1 },
    { id: 'vovo-nena-052', name: 'CREME DE LEITE', quantity: 1 },
    { id: 'vovo-nena-053', name: 'FARINHA DE TRIGO', quantity: 1 },
    { id: 'vovo-nena-054', name: 'FEIJÃO CARIOCA', quantity: 1 },
    { id: 'vovo-nena-055', name: 'FERMENTO', quantity: 1 },
    { id: 'vovo-nena-056', name: 'LEITE CONDENSADO', quantity: 1 },
    { id: 'vovo-nena-057', name: 'LEITE UHT INTEGRAL 1L', quantity: 1 },
    { id: 'vovo-nena-058', name: 'MACARRÃO ESPAGUETE', quantity: 1 },
    { id: 'vovo-nena-059', name: 'MACARRÃO PARAFUSO', quantity: 1 },
    { id: 'vovo-nena-060', name: 'MAIONESE', quantity: 1 },
    { id: 'vovo-nena-061', name: 'MARGARINA', quantity: 1 },
    { id: 'vovo-nena-062', name: 'MATTE', quantity: 1 },
    { id: 'vovo-nena-063', name: 'ÓLEO DE SOJA', quantity: 1 },
    { id: 'vovo-nena-064', name: 'SARDINHA - LATA', quantity: 1 },
    { id: 'vovo-nena-065', name: 'TEMPERO KNORR', quantity: 1 },
    { id: 'vovo-nena-066', name: 'VINAGRE', quantity: 1 },
    { id: 'vovo-nena-067', name: 'CARNE BOVINA - ACÉM', quantity: 1 },
    { id: 'vovo-nena-068', name: 'CARNE BOVINA - MUSCULO', quantity: 1 },
    { id: 'vovo-nena-069', name: 'CARNE BOVINA MOIDA', quantity: 1 },
    { id: 'vovo-nena-070', name: 'COXA SOBRECOXA DE FRANGO', quantity: 1 },
    { id: 'vovo-nena-071', name: 'MOELA DE FRANGO', quantity: 1 },
    { id: 'vovo-nena-072', name: 'PÉ DE FRANGO', quantity: 1 },
    { id: 'vovo-nena-073', name: 'SALSICHA', quantity: 1 }
  ]
};

const RECOVERED_CLIENT_PRE_LISTS: ClientPreList[] = [DEFAULT_VOVO_NENA_PRE_LIST];

const mergeDefaultClientPreLists = (lists: ClientPreList[]) => {
  const defaultClient = normalizeSearchText(DEFAULT_VOVO_NENA_PRE_LIST.clientName);
  const defaultList = normalizeSearchText(DEFAULT_VOVO_NENA_PRE_LIST.listName);
  const otherLists = lists.filter(list =>
    list.id !== DEFAULT_VOVO_NENA_PRE_LIST.id &&
    !(
      normalizeSearchText(list.clientName) === defaultClient &&
      normalizeSearchText(list.listName) === defaultList
    )
  );

  return [DEFAULT_VOVO_NENA_PRE_LIST, ...otherLists];
};

const hasNormalizedPhrase = (text: string, phrases: string[]) =>
  phrases.some(phrase => text.includes(normalizeSearchText(phrase)));

const parseDecimalNumber = (value: string) => Number(value.replace(',', '.'));

const formatPackageAmount = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : String(amount).replace('.', ',');

const getProductPackageInfo = (value: string): ProductPackageInfo | null => {
  const text = normalizeSearchText(value);
  const packageMatch = text.match(/(?:^|\s)(\d+(?:[,.]\d+)?)\s*(kg|quilo|quilos|g|gr|gramas|l|lt|litro|litros|ml|un|und|unid|unidade|unidades)(?:\s|$)/);
  if (!packageMatch) {
    const standaloneUnitMatch = text.match(/(?:^|\s)(kg|quilo|quilos|l|lt|litro|litros|un|und|unid|unidade|unidades)(?:\s|$)/);
    if (!standaloneUnitMatch) return null;

    const rawStandaloneUnit = standaloneUnitMatch[1];
    if (['kg', 'quilo', 'quilos'].includes(rawStandaloneUnit)) {
      return { kind: 'weight', amount: 1, unit: 'kg', normalizedAmount: 1000, label: '1kg' };
    }

    if (['l', 'lt', 'litro', 'litros'].includes(rawStandaloneUnit)) {
      return { kind: 'volume', amount: 1, unit: 'l', normalizedAmount: 1000, label: '1L' };
    }

    return { kind: 'count', amount: 1, unit: 'un', normalizedAmount: 1, label: '1un' };
  }

  const amount = parseDecimalNumber(packageMatch[1]);
  const rawUnit = packageMatch[2];

  if (['kg', 'quilo', 'quilos'].includes(rawUnit)) {
    return { kind: 'weight', amount, unit: 'kg', normalizedAmount: amount * 1000, label: `${formatPackageAmount(amount)}kg` };
  }

  if (['g', 'gr', 'gramas'].includes(rawUnit)) {
    return { kind: 'weight', amount, unit: 'g', normalizedAmount: amount, label: `${formatPackageAmount(amount)}g` };
  }

  if (['l', 'lt', 'litro', 'litros'].includes(rawUnit)) {
    return { kind: 'volume', amount, unit: 'l', normalizedAmount: amount * 1000, label: `${formatPackageAmount(amount)}L` };
  }

  if (rawUnit === 'ml') {
    return { kind: 'volume', amount, unit: 'ml', normalizedAmount: amount, label: `${formatPackageAmount(amount)}ml` };
  }

  return { kind: 'count', amount, unit: 'un', normalizedAmount: amount, label: `${formatPackageAmount(amount)}un` };
};

const hasDifferentExplicitPackage = (queryPackage: ProductPackageInfo | null, productPackage: ProductPackageInfo | null) => {
  if (queryPackage && !productPackage) return true;
  if (!queryPackage || !productPackage) return false;
  return queryPackage.kind !== productPackage.kind || queryPackage.normalizedAmount !== productPackage.normalizedAmount;
};

const ANIMAL_FOOD_TERMS = [
  'alimento para cachorro',
  'alimento para cachorros',
  'alimento para cao',
  'alimento para caes',
  'alimento para gato',
  'alimento para gatos',
  'para cachorro',
  'para cachorros',
  'para cao',
  'para caes',
  'para gato',
  'para gatos',
  'cachorro',
  'cachorros',
  'cao',
  'caes',
  'gato',
  'gatos',
  'petisco canino',
  'petisco felino',
  'bast dog',
  'copadog'
];

const isAnimalFoodProduct = (value: string) => {
  const text = normalizeSearchText(value);
  const tokens = new Set(getSearchTokens(value));

  return tokens.has('racao') ||
    tokens.has('cachorro') ||
    tokens.has('cachorros') ||
    tokens.has('cao') ||
    tokens.has('caes') ||
    tokens.has('gato') ||
    tokens.has('gatos') ||
    hasNormalizedPhrase(` ${text} `, ANIMAL_FOOD_TERMS);
};

const getProductSubtype = (family: ProductFamily, text: string) => {
  const subtypeRules: Partial<Record<ProductFamily, { label: string; terms: string[] }[]>> = {
    rice: [
      { label: 'Tipo 1', terms: ['tipo 1', 't1'] },
      { label: 'Tipo 2', terms: ['tipo 2', 't2'] },
      { label: 'Parboilizado', terms: ['parboilizado'] },
      { label: 'Integral', terms: ['integral'] },
      { label: 'Agulhinha', terms: ['agulhinha'] }
    ],
    beans: [
      { label: 'Carioca', terms: ['carioca', 'carioquinha'] },
      { label: 'Preto', terms: ['preto'] },
      { label: 'Fradinho', terms: ['fradinho'] },
      { label: 'Branco', terms: ['branco'] }
    ],
    sugar: [
      { label: 'Cristal', terms: ['cristal'] },
      { label: 'Refinado', terms: ['refinado'] },
      { label: 'Mascavo', terms: ['mascavo'] },
      { label: 'Demarara', terms: ['demerara', 'demarara'] }
    ],
    oil: [
      { label: 'Soja', terms: ['soja'] },
      { label: 'Girassol', terms: ['girassol'] },
      { label: 'Milho', terms: ['milho'] },
      { label: 'Canola', terms: ['canola'] }
    ],
    coffee: [
      { label: 'Tradicional', terms: ['tradicional'] },
      { label: 'Extra Forte', terms: ['extra forte', 'extraforte'] },
      { label: 'Solúvel', terms: ['soluvel'] },
      { label: 'Cápsula', terms: ['capsula', 'capsulas'] },
      { label: 'Grãos', terms: ['graos', 'grao'] }
    ],
    pasta: [
      { label: 'Espaguete', terms: ['espaguete', 'spaghetti'] },
      { label: 'Parafuso', terms: ['parafuso', 'fusilli'] },
      { label: 'Penne', terms: ['penne'] },
      { label: 'Talharim', terms: ['talharim'] },
      { label: 'Lasanha', terms: ['lasanha'] }
    ],
    flour: [
      { label: 'Trigo', terms: ['trigo'] },
      { label: 'Mandioca', terms: ['mandioca'] },
      { label: 'Milho', terms: ['milho', 'fuba'] },
      { label: 'Rosca', terms: ['rosca'] }
    ],
    biscuit: [
      { label: 'Recheado', terms: ['recheado', 'recheada'] },
      { label: 'Cream Cracker', terms: ['cream cracker', 'cracker'] },
      { label: 'Maizena', terms: ['maizena', 'maisena'] },
      { label: 'Água e Sal', terms: ['agua e sal'] },
      { label: 'Wafer', terms: ['wafer'] }
    ],
    soda: [
      { label: 'Cola', terms: ['coca cola', 'cola'] },
      { label: 'Guaraná', terms: ['guarana'] },
      { label: 'Laranja', terms: ['fanta laranja', 'laranja'] },
      { label: 'Limão', terms: ['sprite', 'limao'] }
    ],
    water_mineral: [
      { label: 'Sem Gás', terms: ['sem gas', 's gas'] },
      { label: 'Com Gás', terms: ['com gas', 'c gas'] }
    ],
    beer: [
      { label: 'Lata', terms: ['lata', 'latinha'] },
      { label: 'Long Neck', terms: ['long neck', 'longneck'] },
      { label: 'Garrafa', terms: ['garrafa', 'garrafao'] },
      { label: 'Puro Malte', terms: ['puro malte'] }
    ],
    diaper: [
      { label: 'P', terms: [' tamanho p ', ' tam p ', ' fralda p '] },
      { label: 'M', terms: [' tamanho m ', ' tam m ', ' fralda m '] },
      { label: 'G', terms: [' tamanho g ', ' tam g ', ' fralda g '] },
      { label: 'XG', terms: [' tamanho xg ', ' tam xg ', ' fralda xg '] },
      { label: 'XXG', terms: [' tamanho xxg ', ' tam xxg ', ' fralda xxg '] }
    ]
  };

  return subtypeRules[family]?.find(rule => hasNormalizedPhrase(` ${text} `, rule.terms))?.label || null;
};

const getProductSearchProfile = (value: string): ProductSearchProfile => {
  const text = normalizeSearchText(value);
  const attributes = new Set<ProductAttribute>();
  const packageInfo = getProductPackageInfo(value);

  if (hasNormalizedPhrase(text, ['zero lactose', 'sem lactose', '0 lactose'])) attributes.add('zero_lactose');
  if (hasNormalizedPhrase(text, ['integral'])) attributes.add('integral');
  if (hasNormalizedPhrase(text, ['semi desnatado', 'semidesnatado'])) attributes.add('semidesnatado');
  if (!attributes.has('semidesnatado') && hasNormalizedPhrase(text, ['desnatado'])) attributes.add('desnatado');
  if (hasNormalizedPhrase(text, ['tradicional', 'original', 'regular'])) attributes.add('traditional');
  if (hasNormalizedPhrase(text, ['zero acucar', 'sem acucar', 'zero'])) attributes.add('zero');
  if (hasNormalizedPhrase(text, ['light'])) attributes.add('light');
  if (hasNormalizedPhrase(text, ['diet'])) attributes.add('diet');

  const tokens = new Set(getSearchTokens(value));
  let family: ProductFamily = 'unknown';

  if (isAnimalFoodProduct(value)) family = 'pet_food';
  else if (hasNormalizedPhrase(text, ['arroz'])) family = 'rice';
  else if (hasNormalizedPhrase(text, ['feijao'])) family = 'beans';
  else if (hasNormalizedPhrase(text, ['acucar'])) family = 'sugar';
  else if (hasNormalizedPhrase(text, ['oleo de soja', 'oleo vegetal', 'oleo'])) family = 'oil';
  else if (hasNormalizedPhrase(text, ['cafe', 'cappuccino'])) family = 'coffee';
  else if (hasNormalizedPhrase(text, ['macarrao', 'massa', 'espaguete', 'parafuso', 'penne'])) family = 'pasta';
  else if (hasNormalizedPhrase(text, ['farinha'])) family = 'flour';
  else if (hasNormalizedPhrase(text, ['biscoito', 'bolacha', 'passatempo'])) family = 'biscuit';
  else if (hasNormalizedPhrase(text, ['refrigerante', 'coca cola', 'guarana', 'fanta', 'sprite', 'soda'])) family = 'soda';
  else if (hasNormalizedPhrase(text, ['agua sanitaria', 'agua sanitar', 'qboa', 'candida', 'alvejante'])) family = 'bleach';
  else if (hasNormalizedPhrase(text, ['agua de coco'])) family = 'coconut_water';
  else if (hasNormalizedPhrase(text, ['agua mineral', 'agua sem gas', 'agua com gas', 'agua c gas', 'agua s gas'])) family = 'water_mineral';
  else if (hasNormalizedPhrase(text, ['cerveja'])) family = 'beer';
  else if (hasNormalizedPhrase(text, ['leite condensado'])) family = 'milk_condensed';
  else if (hasNormalizedPhrase(text, ['creme de leite', 'creme leite'])) family = 'milk_cream';
  else if (hasNormalizedPhrase(text, ['leite em po', 'leite po', 'leite ninho'])) family = 'milk_powder';
  else if (hasNormalizedPhrase(text, ['leite de coco'])) family = 'milk_coconut';
  else if (hasNormalizedPhrase(text, ['doce de leite'])) family = 'milk_sweet';
  else if (hasNormalizedPhrase(text, ['achocolatado', 'bebida achocolatada'])) family = 'chocolate_milk';
  else if (hasNormalizedPhrase(text, ['bebida lactea', 'composto lacteo'])) family = 'dairy_drink';
  else if (
    text === 'leite' ||
    text.startsWith('leite ') ||
    hasNormalizedPhrase(text, [' leite ', 'leite uht', 'leite longa vida', 'uht integral', 'uht desnatado', 'uht semidesnatado'])
  ) {
    family = 'milk_uht';
  } else if (
    tokens.has('sabao') &&
    (tokens.has('barra') || tokens.has('pedra') || tokens.has('pedaco'))
  ) {
    family = 'laundry_bar';
  } else if (hasNormalizedPhrase(text, ['sabao em po', 'detergente em po', 'po lavagem', 'lava roupas', 'lava roupa'])) {
    family = 'laundry_powder';
  } else if (
    text === 'detergente' ||
    text.startsWith('detergente ') ||
    hasNormalizedPhrase(text, ['detergente liquido', 'detergente neutro', 'detergente clear', 'lava loucas'])
  ) {
    family = 'dish_detergent';
  } else if (hasNormalizedPhrase(text, ['papel higienico'])) {
    family = 'toilet_paper';
  } else if (hasNormalizedPhrase(text, ['papel toalha'])) {
    family = 'paper_towel';
  } else if (hasNormalizedPhrase(text, ['fralda', 'pampers'])) {
    family = 'diaper';
  } else if (hasNormalizedPhrase(text, ['shampoo'])) {
    family = 'shampoo';
  } else if (hasNormalizedPhrase(text, ['sabonete'])) {
    family = 'soap';
  } else if (hasNormalizedPhrase(text, ['creme dental', 'pasta dental'])) {
    family = 'toothpaste';
  } else if (hasNormalizedPhrase(text, ['amaciante'])) {
    family = 'softener';
  } else if (hasNormalizedPhrase(text, ['desinfetante'])) {
    family = 'disinfectant';
  } else if (hasNormalizedPhrase(text, ['esponja de aco', 'la de aco', 'bombril', 'assolan'])) {
    family = 'steel_wool';
  } else if (hasNormalizedPhrase(text, ['esponja dupla face', 'esponja multiuso', 'esponja limpeza', 'esponja'])) {
    family = 'cleaning_sponge';
  } else if (hasNormalizedPhrase(text, ['alcool'])) {
    family = 'alcohol';
  } else if (hasNormalizedPhrase(text, ['odorizador de ar', 'odorisador de ar', 'aromatizador', 'bom ar'])) {
    family = 'air_freshener';
  } else if (hasNormalizedPhrase(text, ['querosene'])) {
    family = 'kerosene';
  } else if (hasNormalizedPhrase(text, ['limpa aluminio'])) {
    family = 'aluminum_cleaner';
  }

  return { family, attributes, packageInfo, subtype: getProductSubtype(family, text) };
};

const productFamilyLabels: Record<ProductFamily, string> = {
  rice: 'Arroz',
  beans: 'Feijão',
  sugar: 'Açúcar',
  oil: 'Óleo',
  coffee: 'Café',
  pasta: 'Macarrão',
  flour: 'Farinha',
  biscuit: 'Biscoito',
  soda: 'Refrigerante',
  water_mineral: 'Água Mineral',
  coconut_water: 'Água de Coco',
  beer: 'Cerveja',
  milk_uht: 'Leite UHT',
  milk_condensed: 'Leite Condensado',
  milk_cream: 'Creme de Leite',
  milk_powder: 'Leite em Pó',
  milk_coconut: 'Leite de Coco',
  milk_sweet: 'Doce de Leite',
  chocolate_milk: 'Achocolatado',
  dairy_drink: 'Bebida Láctea',
  laundry_bar: 'Sabão em Barra',
  laundry_powder: 'Sabão em Pó',
  dish_detergent: 'Detergente',
  toilet_paper: 'Papel Higiênico',
  paper_towel: 'Papel Toalha',
  diaper: 'Fralda',
  shampoo: 'Shampoo',
  soap: 'Sabonete',
  toothpaste: 'Creme Dental',
  softener: 'Amaciante',
  disinfectant: 'Desinfetante',
  bleach: 'Água Sanitária',
  steel_wool: 'Esponja/Lã de Aço',
  cleaning_sponge: 'Esponja',
  alcohol: 'Álcool',
  air_freshener: 'Odorizador de Ar',
  kerosene: 'Querosene',
  aluminum_cleaner: 'Limpa Alumínio',
  pet_food: 'Alimento Animal',
  unknown: 'Outros'
};

const getAttributeGroupLabel = (attributes: Set<ProductAttribute>) => {
  const labels: string[] = [];

  if (attributes.has('zero_lactose')) labels.push('Zero Lactose');
  if (attributes.has('integral')) labels.push('Integral');
  if (attributes.has('semidesnatado')) labels.push('Semidesnatado');
  if (attributes.has('desnatado')) labels.push('Desnatado');
  if (attributes.has('zero')) labels.push('Zero');
  if (attributes.has('light')) labels.push('Light');
  if (attributes.has('diet')) labels.push('Diet');
  if (attributes.has('traditional')) labels.push('Tradicional');

  return labels.join(' ');
};

const getProfileProductGroupLabel = (value: string) => {
  const profile = getProductSearchProfile(value);
  if (profile.family === 'unknown') return null;

  const attributeLabel = getAttributeGroupLabel(profile.attributes);

  return [
    productFamilyLabels[profile.family],
    profile.subtype,
    attributeLabel
  ].filter(Boolean).join(' ');
};

const mutuallyExclusiveAttributes: ProductAttribute[][] = [
  ['integral', 'semidesnatado', 'desnatado'],
  ['traditional', 'zero', 'light', 'diet']
];

const hasProductAttributeConflict = (queryAttributes: Set<ProductAttribute>, productAttributes: Set<ProductAttribute>) =>
  mutuallyExclusiveAttributes.some(group =>
    group.some(attribute => queryAttributes.has(attribute)) &&
    group.some(attribute => productAttributes.has(attribute) && !queryAttributes.has(attribute))
  );

const requiredExactSearchAttributes: ProductAttribute[] = [
  'zero_lactose',
  'zero',
  'light',
  'diet'
];

const isMissingRequiredExactProductAttribute = (queryAttributes: Set<ProductAttribute>, productAttributes: Set<ProductAttribute>) =>
  requiredExactSearchAttributes.some(attribute => queryAttributes.has(attribute) && !productAttributes.has(attribute));

const isStrictProductMismatch = (query: string, productName: string) => {
  const queryProfile = getProductSearchProfile(query);
  const productProfile = getProductSearchProfile(productName);

  if (queryProfile.family !== 'unknown' && productProfile.family !== 'unknown' && queryProfile.family !== productProfile.family) {
    return true;
  }

  if (queryProfile.family !== 'unknown' && productProfile.family === 'unknown') {
    return true;
  }

  if (hasProductAttributeConflict(queryProfile.attributes, productProfile.attributes)) {
    return true;
  }

  if (isMissingRequiredExactProductAttribute(queryProfile.attributes, productProfile.attributes)) {
    return true;
  }

  if (hasDifferentExplicitPackage(queryProfile.packageInfo, productProfile.packageInfo)) {
    return true;
  }

  if (queryProfile.family !== 'unknown' && queryProfile.subtype && queryProfile.subtype !== productProfile.subtype) {
    return true;
  }

  if (!queryProfile.attributes.has('zero_lactose') && productProfile.attributes.has('zero_lactose')) {
    return true;
  }

  if (
    queryProfile.family === 'milk_uht' &&
    queryProfile.attributes.size > 0 &&
    ['milk_condensed', 'milk_cream', 'milk_powder', 'milk_coconut', 'milk_sweet', 'chocolate_milk', 'dairy_drink'].includes(productProfile.family)
  ) {
    return true;
  }

  return false;
};

const PRODUCT_EXCLUSIONS: Record<string, string[]> = {
  leite: [
    'creme de leite',
    'leite condensado',
    'leite de coco',
    'doce de leite',
    'achocolatado',
    'bebida lactea',
    'composto lacteo'
  ]
};

const isExcludedProductMatch = (query: string, productName: string) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(productName);
  const queryTokens = getSearchTokens(query);

  if (normalizedQuery === 'leite' || (queryTokens.length === 1 && queryTokens[0] === 'leite')) {
    const isMilkAsMainProduct =
      normalizedName.startsWith('leite ') ||
      normalizedName.includes(' leite uht') ||
      normalizedName.includes(' leite integral') ||
      normalizedName.includes(' leite semidesnatado') ||
      normalizedName.includes(' leite desnatado') ||
      normalizedName.includes(' leite longa vida') ||
      normalizedName.includes(' leite zero lactose');

    return !isMilkAsMainProduct;
  }

  return Object.entries(PRODUCT_EXCLUSIONS).some(([queryToken, excludedPhrases]) => {
    if (normalizedQuery !== queryToken && !(queryTokens.length === 1 && queryTokens[0] === queryToken)) {
      return false;
    }

    return excludedPhrases.some(phrase => normalizedName.includes(normalizeSearchText(phrase)));
  });
};

const tokenMatchesProductText = (token: string, productTokens: Set<string>, productText: string) =>
  productTokens.has(token) || (token.length >= 4 && productText.includes(token));

const getProductMatchScore = (query: string, product: Product) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(product.name);
  const normalizedProductText = normalizeSearchText(`${product.name} ${product.unit}`);
  const normalizedCategory = normalizeSearchText(product.category);
  const normalizedMarket = normalizeSearchText(product.market);
  const queryProfile = getProductSearchProfile(query);
  const productProfile = getProductSearchProfile(`${product.name} ${product.unit}`);
  const hasSameKnownFamily = queryProfile.family !== 'unknown' && productProfile.family === queryProfile.family;

  if (!normalizedQuery) return 1;
  if (isStrictProductMismatch(query, `${product.name} ${product.unit}`)) return 0;
  if (isExcludedProductMatch(query, product.name)) return 0;
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.includes(normalizedQuery)) return 90;
  if (normalizedProductText.includes(normalizedQuery)) return 88;
  if (normalizedQuery.includes(normalizedName)) return 80;

  const queryTokens = getSearchTokens(query);
  if (queryTokens.length === 0) return 0;

  const productTokens = new Set([
    ...getSearchTokens(product.name),
    ...getSearchTokens(product.category),
    ...getSearchTokens(product.market),
    ...getSearchTokens(product.unit)
  ]);

  const hits = queryTokens.filter(token =>
    tokenMatchesProductText(token, productTokens, normalizedName) ||
    (token.length >= 4 && (normalizedCategory.includes(token) || normalizedMarket.includes(token)))
  ).length;

  const score = hits / queryTokens.length;

  if (queryTokens.length <= 2 && score !== 1 && !hasSameKnownFamily) return 0;

  return hasSameKnownFamily ? score + 0.25 : score;
};

const getSavedListItemOfferScore = (query: string, product: Product) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(product.name);
  const normalizedProductText = normalizeSearchText(`${product.name} ${product.unit}`);
  const queryProfile = getProductSearchProfile(query);
  const productProfile = getProductSearchProfile(`${product.name} ${product.unit}`);
  const hasSameKnownFamily = queryProfile.family !== 'unknown' && productProfile.family === queryProfile.family;
  const hasSameKnownPackage = !!(
    queryProfile.packageInfo &&
    productProfile.packageInfo &&
    !hasDifferentExplicitPackage(queryProfile.packageInfo, productProfile.packageInfo)
  );

  if (!normalizedQuery) return 0;
  if (isStrictProductMismatch(query, `${product.name} ${product.unit}`)) return 0;
  if (isExcludedProductMatch(query, product.name)) return 0;
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.includes(normalizedQuery)) return 90;
  if (normalizedProductText.includes(normalizedQuery)) return 88;

  const queryTokens = getSearchTokens(query);
  if (queryTokens.length === 0) return 0;

  const productTokens = new Set([
    ...getSearchTokens(product.name),
    ...getSearchTokens(product.category),
    ...getSearchTokens(product.unit)
  ]);
  const hits = queryTokens.filter(token => tokenMatchesProductText(token, productTokens, normalizedProductText)).length;
  let score = hits / queryTokens.length;

  if (queryTokens.length <= 2) {
    if (score !== 1 && !hasSameKnownFamily) return 0;
  } else if (score < (hasSameKnownFamily && (hasSameKnownPackage || !queryProfile.packageInfo) ? 0.6 : 0.8)) {
    return 0;
  }

  const queryBrand = getLikelyBrand(query);
  const productBrand = getLikelyBrand(product.name);

  if (hasSameKnownFamily) score += 0.25;
  if (queryProfile.subtype && queryProfile.subtype === productProfile.subtype) score += 0.15;
  if (hasSameKnownPackage) score += 0.2;
  if (queryBrand !== '-' && productBrand !== '-') {
    score += queryBrand === productBrand ? 0.25 : -0.4;
  }

  return Math.max(0, score);
};

const KNOWN_BRANDS = [
  '3 Corações', 'Adria', 'Aurora', 'Bauducco', 'Brahma', 'Camil', 'Claybom',
  'Coca-Cola', 'Colgate', 'Dove', 'Downy', 'Globo', 'Heineken', 'Ipê', 'Liza',
  'Melitta', 'Nestlé', 'Ninho', 'Omo', 'Pampers', 'Pantene', 'Perdigão',
  'Piracanjuba', 'Pullman', 'Sadia', 'São Judas Tadeu', 'Seara', 'Tio João',
  'União', 'Ypê'
];

const getLikelyBrand = (productName: string) => {
  const normalizedName = normalizeSearchText(productName);
  const brand = KNOWN_BRANDS.find(item => normalizedName.includes(normalizeSearchText(item)));
  return brand || '-';
};

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const getProductPackageValueLabel = (packageInfo: ProductPackageInfo) => {
  if (packageInfo.kind === 'weight') return 'kg';
  if (packageInfo.kind === 'volume') return 'L';
  return 'un';
};

const getPackageValuePrice = (price: number, packageInfo: ProductPackageInfo) => {
  if (packageInfo.normalizedAmount <= 0) return null;

  if (packageInfo.kind === 'weight') {
    return (price / packageInfo.normalizedAmount) * 1000;
  }

  if (packageInfo.kind === 'volume') {
    return (price / packageInfo.normalizedAmount) * 1000;
  }

  return price / packageInfo.normalizedAmount;
};

const getProductPackageValue = (product: Product) => {
  const packageInfo = getProductPackageInfo(`${product.name} ${product.unit}`);
  if (!packageInfo) return null;

  const valuePrice = getPackageValuePrice(product.price, packageInfo);
  if (valuePrice === null) return null;

  return {
    packageInfo,
    valuePrice,
    label: `${formatCurrency(valuePrice)}/${getProductPackageValueLabel(packageInfo)}`
  };
};

const compareProductsByPackageValue = (a: Product, b: Product) => {
  const aValue = getProductPackageValue(a)?.valuePrice;
  const bValue = getProductPackageValue(b)?.valuePrice;

  if (aValue !== undefined && bValue !== undefined && aValue !== bValue) return aValue - bValue;
  if (aValue !== undefined && bValue === undefined) return -1;
  if (aValue === undefined && bValue !== undefined) return 1;
  if (a.price !== b.price) return a.price - b.price;
  return a.market.localeCompare(b.market, 'pt-BR') ||
    a.name.localeCompare(b.name, 'pt-BR');
};

const getReportShift = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 9) return 'TURNO1';
  if (hour < 15) return 'TURNO2';
  return 'TURNO3';
};

const padDatePart = (value: number) => String(value).padStart(2, '0');

const getPricesPdfFileName = (date = new Date()) => {
  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `PREÇOS - ${getReportShift(date)}_${day}${month}${year}_${hour}${minute}`;
};

const formatPromotionDate = (endDateStr?: string) => {
  if (!endDateStr) return 'Validade não informada';
  const [, month, day] = endDateStr.split('-');
  if (!day || !month) return 'Validade não informada';
  return `Até ${day}/${month}`;
};

const PRODUCT_GROUP_DEFINITIONS = [
  { label: 'Café', terms: ['cafe', 'cappuccino'] },
  { label: 'Arroz', terms: ['arroz'] },
  { label: 'Feijão', terms: ['feijao'] },
  { label: 'Sabão', terms: ['sabao', 'lava roupa', 'lava roupas', 'po lavagem', 'detergente em po'] },
  { label: 'Detergente', terms: ['detergente'] },
  { label: 'Biscoito', terms: ['biscoito', 'bolacha', 'passatempo'] },
  { label: 'Farinha', terms: ['farinha'] },
  { label: 'Açúcar', terms: ['acucar'] },
  { label: 'Óleo', terms: ['oleo'] },
  { label: 'Macarrão', terms: ['macarrao', 'massa'] },
  { label: 'Leite Condensado', terms: ['leite condensado'] },
  { label: 'Creme de Leite', terms: ['creme de leite', 'creme leite'] },
  { label: 'Fralda', terms: ['fralda', 'pampers'] },
  { label: 'Cerveja', terms: ['cerveja'] },
  { label: 'Refrigerante', terms: ['refrigerante', 'coca cola', 'guarana', 'fanta'] },
  { label: 'Carne', terms: ['carne', 'alcatra', 'contra file', 'costela'] },
  { label: 'Frango', terms: ['frango'] },
  { label: 'Queijo', terms: ['queijo', 'mucarela', 'mussarela'] },
  { label: 'Presunto', terms: ['presunto'] },
  { label: 'Papel', terms: ['papel higienico', 'papel toalha'] },
  { label: 'Shampoo', terms: ['shampoo'] },
  { label: 'Sabonete', terms: ['sabonete'] },
  { label: 'Creme Dental', terms: ['creme dental', 'pasta dental'] },
  { label: 'Amaciante', terms: ['amaciante'] },
  { label: 'Desinfetante', terms: ['desinfetante'] },
  { label: 'Alimento Animal', terms: ANIMAL_FOOD_TERMS }
];

const getProductGroup = (productName: string, unit = '') => {
  const productText = `${productName} ${unit}`;
  const profileGroup = getProfileProductGroupLabel(productText);
  if (profileGroup) return profileGroup;

  const normalizedName = normalizeSearchText(productText);

  if (!isExcludedProductMatch('leite', productName)) {
    return 'Leite';
  }

  const group = PRODUCT_GROUP_DEFINITIONS.find(definition =>
    definition.terms.some(term => normalizedName.includes(normalizeSearchText(term)))
  );

  if (group) {
    const profile = getProductSearchProfile(productText);
    const attributeLabel = getAttributeGroupLabel(profile.attributes);
    return [
      group.label,
      attributeLabel
    ].filter(Boolean).join(' ');
  }

  const [firstToken] = getSearchTokens(productName)
    .filter(token => !KNOWN_BRANDS.some(brand => normalizeSearchText(brand).split(' ').includes(token)));

  return firstToken ? firstToken.charAt(0).toUpperCase() + firstToken.slice(1) : 'Outros';
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(loadSavedProducts);
  
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  
  const [activeTab, setActiveTab] = useState<'upload' | 'catalog' | 'simulator' | 'prelists'>('simulator');
  
  // Upload States
  const [marketName, setMarketName] = useState('');
  const [cityInput, setCityInput] = useState('Ourinhos');
  const [urlInput, setUrlInput] = useState('');
  const [manualTextInput, setManualTextInput] = useState('');
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');
  const [importMethod, setImportMethod] = useState<'pdf' | 'url' | 'text' | 'image' | 'online'>('pdf');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [whatsAppBridgeStatus, setWhatsAppBridgeStatus] = useState('Aguardando coletor local');
  const [whatsAppCollectorConfig, setWhatsAppCollectorConfig] = useState<WhatsAppCollectorConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const importedWhatsAppIds = useRef<Set<string>>(new Set());
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedProductGroup, setSelectedProductGroup] = useState('Todos');
  const [selectedMarket, setSelectedMarket] = useState('Todos');
  const [selectedCity, setSelectedCity] = useState('Ourinhos');
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [whatsAppText, setWhatsAppText] = useState('');
  
  // Shopping List States
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('shopping_list');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Arroz Tio João Tipo 1 5kg', quantity: 1 },
      { id: '2', name: 'Feijão Carioca Camil 1kg', quantity: 2 },
      { id: '3', name: 'Leite Integral Piracanjuba 1L', quantity: 6 },
      { id: '4', name: 'Alcatra Bovina kg', quantity: 2 },
    ];
  });
  const [selectedOfferIds, setSelectedOfferIds] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('selected_offer_ids');
    return saved ? JSON.parse(saved) : {};
  });
  const [customItemInput, setCustomItemInput] = useState('');
  const [debouncedCustomItemInput, setDebouncedCustomItemInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [clientNameInput, setClientNameInput] = useState('');
  const [preListNameInput, setPreListNameInput] = useState('');
  const [editingPreListId, setEditingPreListId] = useState<string | null>(null);
  const [preListSaveStatus, setPreListSaveStatus] = useState('');
  const [clientPreLists, setClientPreLists] = useState<ClientPreList[]>(() => {
    const saved = localStorage.getItem('client_pre_lists');
    const recoveryApplied = localStorage.getItem('client_pre_lists_recovery_applied') === 'true';
    const defaultListsVersion = localStorage.getItem('client_pre_lists_default_version');
    if (!saved && !recoveryApplied) {
      localStorage.setItem('client_pre_lists_recovery_applied', 'true');
      localStorage.setItem('client_pre_lists_default_version', DEFAULT_CLIENT_PRE_LISTS_VERSION);
      return RECOVERED_CLIENT_PRE_LISTS;
    }
    if (!saved) {
      if (defaultListsVersion !== DEFAULT_CLIENT_PRE_LISTS_VERSION) {
        localStorage.setItem('client_pre_lists_default_version', DEFAULT_CLIENT_PRE_LISTS_VERSION);
        return RECOVERED_CLIENT_PRE_LISTS;
      }

      return [];
    }

    try {
      const parsed = JSON.parse(saved) as ClientPreList[];
      if (defaultListsVersion !== DEFAULT_CLIENT_PRE_LISTS_VERSION) {
        localStorage.setItem('client_pre_lists_default_version', DEFAULT_CLIENT_PRE_LISTS_VERSION);
        return mergeDefaultClientPreLists(parsed);
      }

      if (parsed.length === 0 && !recoveryApplied) {
        localStorage.setItem('client_pre_lists_recovery_applied', 'true');
        localStorage.setItem('client_pre_lists_default_version', DEFAULT_CLIENT_PRE_LISTS_VERSION);
        return RECOVERED_CLIENT_PRE_LISTS;
      }

      return parsed;
    } catch {
      localStorage.removeItem('client_pre_lists');
      if (!recoveryApplied) {
        localStorage.setItem('client_pre_lists_recovery_applied', 'true');
        localStorage.setItem('client_pre_lists_default_version', DEFAULT_CLIENT_PRE_LISTS_VERSION);
        return RECOVERED_CLIENT_PRE_LISTS;
      }

      return [];
    }
  });

  // Save data to localStorage
  useEffect(() => {
    const activeProducts = removeExpiredProducts(products);
    if (activeProducts.length !== products.length) {
      setProducts(activeProducts);
      return;
    }

    localStorage.setItem('products_list', JSON.stringify(activeProducts));
  }, [products]);

  useEffect(() => {
    const activeOfferIds = new Set(products.map(product => product.id));
    setSelectedOfferIds(prev => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, offerId]) => activeOfferIds.has(offerId))
      );

      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [products]);

  useEffect(() => {
    localStorage.setItem('shopping_list', JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    if (editingPreListId) {
      setPreListSaveStatus('');
    }
  }, [shoppingList, clientNameInput, preListNameInput, selectedCity, editingPreListId]);

  useEffect(() => {
    localStorage.setItem('selected_offer_ids', JSON.stringify(selectedOfferIds));
  }, [selectedOfferIds]);

  useEffect(() => {
    localStorage.setItem('client_pre_lists', JSON.stringify(clientPreLists));
  }, [clientPreLists]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;

    const importFromWhatsAppBridge = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/whatsapp-imports');
        if (!response.ok) throw new Error('Coletor indisponível');

        const data: { offers?: Product[]; shoppingItems?: ShoppingItem[] } = await response.json();
        const incomingOffers = data.offers || [];
        const incomingItems = data.shoppingItems || [];

        if (cancelled) return;

        if (incomingOffers.length === 0 && incomingItems.length === 0) {
          setWhatsAppBridgeStatus('Coletor conectado. Nenhuma oferta nova.');
          return;
        }

        let addedOffers = 0;
        if (incomingOffers.length > 0) {
          setProducts(prev => {
            const existingKeys = new Set(removeExpiredProducts(prev).map(getProductDuplicateKey));
            const nextProducts = [...prev];

            incomingOffers.forEach(offer => {
              if (importedWhatsAppIds.current.has(offer.id)) return;
              const normalizedOffer = normalizeProductOfferDates(offer);
              if (isDateExpired(normalizedOffer.endDate)) return;

              const key = getProductDuplicateKey(normalizedOffer);
              importedWhatsAppIds.current.add(offer.id);

              if (!existingKeys.has(key)) {
                existingKeys.add(key);
                nextProducts.push(normalizedOffer);
                addedOffers += 1;
              }
            });

            return removeExpiredProducts(nextProducts);
          });
        }

        if (incomingItems.length > 0) {
          setShoppingList(prev => {
            const nextItems = [...prev];

            incomingItems.forEach(item => {
              if (importedWhatsAppIds.current.has(item.id)) return;
              importedWhatsAppIds.current.add(item.id);

              const incomingKey = getShoppingItemDuplicateKey(item);
              const idx = nextItems.findIndex(existing => getShoppingItemDuplicateKey(existing) === incomingKey);
              if (idx > -1) {
                nextItems[idx] = {
                  ...nextItems[idx],
                  quantity: nextItems[idx].quantity + item.quantity
                };
              } else {
                nextItems.push(item);
              }
            });

            return consolidateShoppingItems(nextItems);
          });
        }

        await fetch('http://localhost:3001/api/whatsapp-clear', { method: 'POST' });
        setWhatsAppBridgeStatus(`Importado pelo coletor: ${addedOffers} ofertas e ${incomingItems.length} itens de lista.`);
      } catch {
        if (!cancelled) {
          setWhatsAppBridgeStatus('Coletor local não está rodando neste computador.');
        }
      }
    };

    const loadWhatsAppConfig = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/whatsapp-config');
        if (!response.ok) return;
        const config = await response.json() as WhatsAppCollectorConfig;
        if (!cancelled) {
          setWhatsAppCollectorConfig(config);
        }
      } catch {
        if (!cancelled) {
          setWhatsAppCollectorConfig(null);
        }
      }
    };

    loadWhatsAppConfig();
    importFromWhatsAppBridge();
    const interval = window.setInterval(importFromWhatsAppBridge, 8000);
    const configInterval = window.setInterval(loadWhatsAppConfig, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearInterval(configInterval);
    };
  }, []);

  // Unique lists for filtering dropdowns
  const markets = useMemo(() => Array.from(new Set(products.map(p => p.market))), [products]);
  const cities = useMemo(() => Array.from(new Set(products.map(p => p.city))), [products]);
  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const productGroups = useMemo(
    () => ['Todos', ...Array.from(new Set(products.map(p => getProductGroup(p.name, p.unit)))).sort((a, b) => a.localeCompare(b, 'pt-BR'))],
    [products]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCustomItemInput(customItemInput);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [customItemInput]);

  // Suggestions for autocomplete
  useEffect(() => {
    const query = debouncedCustomItemInput.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }

    const matches = Array.from(new Set(
      products
        .filter(p => selectedCity === 'Todas' || p.city === selectedCity)
        .map(product => ({ product, score: getProductMatchScore(query, product) }))
        .filter(({ score }) => score >= 0.45)
        .sort((a, b) => b.score - a.score)
        .map(({ product }) => product.name)
    )).slice(0, 8);
    setSuggestions(matches);
  }, [debouncedCustomItemInput, products, selectedCity]);

  // Validate dates (checking if expired based on current date)
  const getValidityStatus = (endDateStr?: string) => {
    if (!endDateStr) return { label: 'Validade não informada', type: 'info' };

    if (isDateExpired(endDateStr)) {
      return { label: 'Oferta Expirada', type: 'expired' };
    }

    const diffDays = getDaysUntilDate(endDateStr) ?? 0;
    
    if (diffDays === 0) {
      return { label: 'Expira hoje', type: 'warning' };
    }

    if (diffDays === 1) {
      return { label: 'Expira amanhã', type: 'warning' };
    }

    if (diffDays <= 2) {
      return { label: `Expira em ${diffDays} dia(s)`, type: 'warning' };
    }
    
    // Format date to local DD/MM
    const [, month, day] = endDateStr.split('-');
    return { label: `Válido até ${day}/${month}`, type: 'valid' };
  };

  // Generic function to process imported text (from PDF, URL, or Text paste)
  const processImportedText = async (text: string) => {
    setUploadStatus('Analisando ofertas com Inteligência Artificial...');
    let extractedProducts: Product[] = [];
    
    if (apiKey.trim()) {
      extractedProducts = await extractOffersWithGemini(text, apiKey, marketName, cityInput);
    } else {
      setUploadStatus('Extraindo com analisador local (sem API Key)...');
      extractedProducts = extractOffersFallback(text, marketName, cityInput);
    }

    extractedProducts = removeExpiredProducts(extractedProducts.map(p => ({
      ...p,
      startDate: manualStartDate || p.startDate,
      endDate: manualEndDate || p.endDate
    })));

    // Apply manual date overrides if provided
    if (extractedProducts.length > 0) {
      setProducts(prev => removeExpiredProducts([...prev, ...extractedProducts]));
      setUploadStatus(`Sucesso! ${extractedProducts.length} ofertas importadas de ${marketName} (${cityInput}).`);
      
      // Reset fields
      setMarketName('');
      setUrlInput('');
      setManualTextInput('');
      setManualStartDate('');
      setManualEndDate('');
    } else {
      setUploadStatus('Nenhuma oferta válida foi importada. Ofertas vencidas são excluídas automaticamente.');
    }
  };

  // Handle PDF Upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!marketName.trim()) {
      alert('Por favor, informe o nome do supermercado antes de enviar.');
      return;
    }

    setUploading(true);
    let totalImported = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(`Lendo PDF (${i + 1}/${files.length}): ${file.name}...`);
        const rawText = await extractTextFromPDF(file);
        
        setUploadStatus(`Analisando ofertas (${i + 1}/${files.length}): ${file.name}...`);
        let extractedProducts: Product[] = [];
        
        if (apiKey.trim()) {
          if (rawText.trim().length > 80) {
            extractedProducts = await extractOffersWithGemini(rawText, apiKey, marketName, cityInput);
          }

          if (extractedProducts.length === 0) {
            setUploadStatus(`PDF parece ser imagem/encarte (${i + 1}/${files.length}). Fazendo leitura visual com IA: ${file.name}...`);
            extractedProducts = await extractOffersFromPDFFile(file, apiKey, marketName, cityInput);
          }
        } else {
          extractedProducts = extractOffersFallback(rawText, marketName, cityInput);
        }

        if (extractedProducts.length > 0) {
          extractedProducts = removeExpiredProducts(extractedProducts.map(p => ({
            ...p,
            startDate: manualStartDate || p.startDate,
            endDate: manualEndDate || p.endDate
          })));
          setProducts(prev => removeExpiredProducts([...prev, ...extractedProducts]));
          totalImported += extractedProducts.length;
        }
      }
      
      setUploadStatus(totalImported > 0
        ? `Sucesso! ${totalImported} ofertas importadas de ${files.length} PDFs.`
        : apiKey.trim()
          ? `Nenhuma oferta identificada em ${files.length} PDFs. Confira se o arquivo tem produtos/preços legíveis.`
          : `Nenhuma oferta importada. Para PDF em imagem/encarte escaneado, informe a chave Gemini para leitura visual.`
      );
      setMarketName('');
      setManualStartDate('');
      setManualEndDate('');
    } catch (err: any) {
      console.error(err);
      setUploadStatus(`Erro ao processar PDF: ${err.message || 'Falha na leitura ou extração.'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle URL Fetch
  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
      alert('Por favor, insira o link da página.');
      return;
    }
    if (!marketName.trim()) {
      alert('Por favor, informe o nome do supermercado.');
      return;
    }

    setUploading(true);
    setUploadStatus('Buscando conteúdo da página web...');
    
    try {
      const htmlText = await fetchHtmlFromUrl(urlInput);
      await processImportedText(htmlText);
    } catch (err: any) {
      setUploadStatus(err.message || 'Falha ao buscar URL.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Manual Text Import
  const handleTextImport = async () => {
    if (!manualTextInput.trim()) {
      alert('Por favor, insira o texto ou HTML copiado do site.');
      return;
    }
    if (!marketName.trim()) {
      alert('Por favor, informe o nome do supermercado.');
      return;
    }

    setUploading(true);
    setUploadStatus('Lendo texto colado...');
    
    try {
      await processImportedText(manualTextInput);
    } catch {
      setUploadStatus('Falha ao processar texto.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Image Upload (Multimodal AI)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!marketName.trim()) {
      alert('Por favor, informe o nome do supermercado.');
      return;
    }

    setUploading(true);
    let totalImported = 0;
    
    try {
      if (apiKey.trim()) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadStatus(`Analisando imagem (${i + 1}/${files.length}): ${file.name}...`);
          
          let extractedProducts = await extractOffersFromImage(file, apiKey, marketName, cityInput);
          
          if (extractedProducts.length > 0) {
            extractedProducts = removeExpiredProducts(extractedProducts.map(p => ({
              ...p,
              startDate: manualStartDate || p.startDate,
              endDate: manualEndDate || p.endDate
            })));

            setProducts(prev => removeExpiredProducts([...prev, ...extractedProducts]));
            totalImported += extractedProducts.length;
          }
        }
        setUploadStatus(totalImported > 0
          ? `Sucesso! ${totalImported} ofertas importadas de ${files.length} imagens.`
          : 'Nenhuma oferta válida foi importada. Ofertas vencidas são excluídas automaticamente.'
        );
        setMarketName('');
        setManualStartDate('');
        setManualEndDate('');
      } else {
        alert('A leitura/digitalização de imagem requer uma Gemini API Key ativa. Por favor, insira sua chave no topo da tela.');
        setUploadStatus('Importação cancelada: Chave de API ausente para processamento de imagem.');
      }
    } catch (err) {
      console.error(err);
      setUploadStatus('Falha ao processar as imagens. Verifique a chave da API.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Online Search (Web Grounding)
  const handleOnlineSearch = async () => {
    if (!apiKey.trim()) {
      alert('A Varredura Online requer uma Gemini API Key ativa. Por favor, insira sua chave no topo da tela.');
      return;
    }
    setUploading(true);
    const queryFromList = shoppingList.map(item => item.name).join(', ');
    const effectiveQuery = onlineSearchQuery.trim() || queryFromList;
    setUploadStatus(`Pesquisando preços online em ${cityInput}${effectiveQuery ? ` para: ${effectiveQuery}` : ''}...`);
    
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const extractedProducts = removeExpiredProducts(await searchOffersOnline(apiKey, effectiveQuery, cityInput, todayStr));
      
      if (extractedProducts.length > 0) {
        setProducts(prev => {
          const existingKeys = new Set(removeExpiredProducts(prev).map(getProductDuplicateKey));
          const newProducts = extractedProducts.filter(p => {
            const key = getProductDuplicateKey(p);
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
          });
          return removeExpiredProducts([...prev, ...newProducts]);
        });
        setUploadStatus(`Sucesso! ${extractedProducts.length} ofertas encontradas na internet para a cidade de ${cityInput}.`);
        setOnlineSearchQuery('');
      } else {
        setUploadStatus('Nenhuma oferta recente encontrada na internet. Tente refinar a busca ou buscar outro produto.');
      }
    } catch (err: any) {
      console.error(err);
      setUploadStatus(`Erro ao pesquisar online: ${err.message || 'Falha na varredura.'}`);
    } finally {
      setUploading(false);
    }
  };

  // Import Informal Text Lists from WhatsApp via Gemini AI
  const handleImportWhatsAppList = async () => {
    if (!whatsAppText.trim()) {
      alert('Por favor, cole um texto antes de importar.');
      return;
    }
    if (!apiKey.trim()) {
      alert('A extração via IA requer uma Gemini API Key ativa. Por favor, insira sua chave no topo da tela.');
      return;
    }
    setUploading(true);
    setUploadStatus('Analisando texto da conversa do WhatsApp...');
    try {
      const items = await parseInformalShoppingList(whatsAppText, apiKey);
      if (items.length > 0) {
        setShoppingList(prev => {
          let updated = [...prev];
          items.forEach(newItem => {
            const incomingKey = getShoppingItemDuplicateKey(newItem);
            const idx = updated.findIndex(existing => getShoppingItemDuplicateKey(existing) === incomingKey);
            if (idx > -1) {
              updated[idx].quantity += newItem.quantity;
            } else {
              updated.push({ id: String(Date.now() + Math.random()), name: newItem.name, quantity: newItem.quantity });
            }
          });
          return consolidateShoppingItems(updated);
        });
        setWhatsAppText('');
        setUploadStatus(`Sucesso! ${items.length} itens extraídos da mensagem e adicionados à lista.`);
      } else {
        setUploadStatus('Não foi possível identificar itens de compra no texto informado.');
      }
    } catch (err: any) {
      console.error(err);
      setUploadStatus(`Erro ao extrair lista: ${err.message || 'Falha na análise.'}`);
    } finally {
      setUploading(false);
    }
  };

  // Format and Share Shopping List with WhatsApp
  const shareListOnWhatsApp = () => {
    if (shoppingList.length === 0) return;

    let msg = `🛒 *Radar de Preços - Ourinhos*\n`;
    msg += `📍 *Cidade:* ${selectedCity}\n\n`;
    msg += `💵 *Compra Dividida (Preço Mínimo):* R$ ${optimizedTotal.toFixed(2)}\n`;
    if (bestAllInOne) {
      msg += `🏪 *Comprar tudo no ${bestAllInOne.marketName}:* R$ ${bestAllInOne.total.toFixed(2)}\n`;
    }
    msg += `\n*Lista de Itens Recomendados:*\n`;

    optimizedItems.forEach(item => {
      const isFound = item.market !== 'Não encontrado';
      if (isFound) {
        msg += `- ${item.quantity}x _${item.name}_ ➜ *R$ ${item.price.toFixed(2)}*${item.packageValueLabel ? ` (${item.packageValueLabel})` : ''} (no ${item.market}) - ${formatPromotionDate(item.endDate)}\n`;
      } else {
        msg += `- ${item.quantity}x _${item.name}_ ➜ *Não encontrado*\n`;
      }
    });

    msg += `\nGerado automaticamente via Radar de Preços 🚀`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const escapeHtml = (value: string | number | undefined | null) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const openPrintableReport = (title: string, bodyHtml: string, city = selectedCity, subtitle?: string) => {
    const pdfFileName = getPricesPdfFileName();
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('O navegador bloqueou a janela do PDF. Permita pop-ups para este site.');
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${pdfFileName}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            h2 { font-size: 15px; margin: 18px 0 8px; }
            .meta, .note { font-size: 11px; color: #4b5563; margin-bottom: 12px; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0; }
            .box { border: 1px solid #d1d5db; padding: 8px; border-radius: 6px; }
            .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 700; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; break-inside: auto; page-break-inside: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th, td { border: 1px solid #d1d5db; padding: 6px 7px; font-size: 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
            td.money, th.money { text-align: right; white-space: nowrap; }
            .missing { color: #b91c1c; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} - Cidade: ${city}
            ${subtitle ? `<br>${subtitle}` : ''}
          </div>
          ${bodyHtml}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  const exportPurchaseByMarketPdf = () => {
    if (shoppingList.length === 0) {
      alert('Adicione itens na lista de compras antes de gerar o PDF.');
      return;
    }

    const comparisonsWithFoundItems = allInOneComparisons
      .map(comparison => ({
        ...comparison,
        items: comparison.items.filter(item => item.found)
      }))
      .filter(comparison => comparison.items.length > 0);

    if (comparisonsWithFoundItems.length === 0) {
      alert('Nenhum item com preço encontrado para gerar o PDF.');
      return;
    }

    const bodyHtml = comparisonsWithFoundItems
      .sort((a, b) => {
        if (b.availableCount !== a.availableCount) return b.availableCount - a.availableCount;
        return a.total - b.total;
      })
      .map(comparison => `
        <h2>${comparison.marketName}</h2>
        <div class="note">
          Total encontrado: R$ ${comparison.total.toFixed(2).replace('.', ',')} -
          Itens com preço: ${comparison.items.length}
        </div>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Marca</th>
              <th>UND</th>
              <th class="money">Qtd</th>
              <th class="money">Valor Unit.</th>
              <th class="money">R$/Base</th>
              <th class="money">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.items
              .sort((a, b) => (a.catalogName || a.itemName).localeCompare(b.catalogName || b.itemName, 'pt-BR'))
              .map(item => `
              <tr>
                <td>${item.catalogName || item.itemName}</td>
                <td>${getLikelyBrand(item.catalogName || item.itemName)}</td>
                <td>${item.unit || '-'}</td>
                <td class="money">${item.quantity}</td>
                <td class="money">${item.found ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : '-'}</td>
                <td class="money">${item.packageValueLabel || '-'}</td>
                <td class="money">${item.found ? `R$ ${item.subtotal.toFixed(2).replace('.', ',')}` : '-'}</td>
              </tr>
            `).join('')}
            <tr>
              <th colspan="6" class="money">Subtotal ${comparison.marketName}</th>
              <th class="money">R$ ${comparison.total.toFixed(2).replace('.', ',')}</th>
            </tr>
          </tbody>
        </table>
      `).join('');

    openPrintableReport('Compra por Mercado', bodyHtml);
  };

  const exportBestPurchasePdf = (
    list = shoppingList,
    city = selectedCity,
    title = 'Melhores Precos e Melhor Compra',
    subtitle?: string
  ) => {
    if (list.length === 0) {
      alert('Adicione itens na lista de compras antes de gerar o PDF.');
      return;
    }

    const comparison = list === shoppingList && city === selectedCity
      ? currentComparison
      : calculatePurchaseComparison(list, city);
    const bestSingleMarket = comparison.bestAllInOne;
    const savings = bestSingleMarket && bestSingleMarket.total > 0
      ? Math.max(0, bestSingleMarket.total - comparison.optimizedTotal)
      : 0;
    const savingsPercent = bestSingleMarket && bestSingleMarket.total > 0
      ? (savings / bestSingleMarket.total) * 100
      : 0;
    const foundOptimizedItems = comparison.optimizedItems.filter(item => item.market !== 'Não encontrado');

    if (foundOptimizedItems.length === 0) {
      alert('Nenhum item com preço encontrado para gerar o PDF.');
      return;
    }

    const groupedOptimizedItems = foundOptimizedItems.reduce<Record<string, OptimizedItem[]>>((acc, item) => {
      const market = item.market || 'Não encontrado';
      acc[market] = acc[market] || [];
      acc[market].push(item);
      return acc;
    }, {});

    const groupedRowsHtml = Object.entries(groupedOptimizedItems)
      .sort(([marketA], [marketB]) => {
        return marketA.localeCompare(marketB, 'pt-BR');
      })
      .map(([market, items]) => {
        const marketSubtotal = items.reduce((total, item) => total + item.subtotal, 0);

        return `
          <h2>${market}</h2>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Marca</th>
                <th>UND</th>
                <th class="money">Qtd</th>
                <th class="money">Valor Unit.</th>
                <th class="money">R$/Base</th>
                <th>Validade</th>
                <th class="money">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .sort((a, b) => (a.catalogName || a.name).localeCompare(b.catalogName || b.name, 'pt-BR'))
                .map(item => `
                  <tr>
                    <td>${item.catalogName || item.name}</td>
                    <td>${getLikelyBrand(item.catalogName || item.name)}</td>
                    <td>${item.unit || '-'}</td>
                    <td class="money">${item.quantity}</td>
                    <td class="money">R$ ${item.price.toFixed(2).replace('.', ',')}</td>
                    <td class="money">${item.packageValueLabel || '-'}</td>
                    <td>${formatPromotionDate(item.endDate)}</td>
                    <td class="money">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
                  </tr>
                `).join('')}
              <tr>
                <th colspan="7" class="money">Subtotal ${market}</th>
                <th class="money">R$ ${marketSubtotal.toFixed(2).replace('.', ',')}</th>
              </tr>
            </tbody>
          </table>
        `;
      }).join('');

    const bodyHtml = `
      <div class="summary">
        <div class="box">
          <div class="label">Melhor compra dividida</div>
          <div class="value">R$ ${comparison.optimizedTotal.toFixed(2).replace('.', ',')}</div>
        </div>
        <div class="box">
          <div class="label">Melhor mercado unico</div>
          <div class="value">${bestSingleMarket ? `${bestSingleMarket.marketName} - R$ ${bestSingleMarket.total.toFixed(2).replace('.', ',')}` : 'N/A'}</div>
        </div>
        <div class="box">
          <div class="label">Economia estimada</div>
          <div class="value">R$ ${savings.toFixed(2).replace('.', ',')} (${savingsPercent.toFixed(1).replace('.', ',')}%)</div>
        </div>
      </div>
      ${groupedRowsHtml}
      <div class="note">
        A escolha automática compara o custo por kg, litro ou unidade quando a embalagem é identificada. A economia compara a compra dividida pelos menores custos encontrados com a melhor opcao de comprar tudo em um unico mercado.
      </div>
    `;

    openPrintableReport(title, bodyHtml, city, subtitle);
  };

  const exportBestPriceByItemPdf = (
    list = shoppingList,
    city = selectedCity,
    title = 'Melhor Preco de Cada Item',
    subtitle?: string
  ) => {
    if (list.length === 0) {
      alert('Adicione itens na lista de compras antes de gerar o PDF.');
      return;
    }

    const consolidatedList = consolidateShoppingItems(list);
    const rows = consolidatedList
      .map(item => {
        const offers = getAllOfferOptionsForItem(item.name, city);
        const bestOffer = offers[0];
        const value = bestOffer ? getProductPackageValue(bestOffer) : null;

        return {
          item,
          offer: bestOffer,
          value,
          subtotal: bestOffer ? bestOffer.price * item.quantity : 0
        };
      })
      .sort((a, b) => a.item.name.localeCompare(b.item.name, 'pt-BR'));

    const foundRows = rows.filter(row => row.offer);
    const total = foundRows.reduce((sum, row) => sum + row.subtotal, 0);

    if (foundRows.length === 0) {
      alert('Nenhum item com preço encontrado para gerar o PDF.');
      return;
    }

    const bodyHtml = `
      <div class="summary">
        <div class="box">
          <div class="label">Itens com preço</div>
          <div class="value">${foundRows.length}</div>
        </div>
        <div class="box">
          <div class="label">Itens omitidos sem preço</div>
          <div class="value">${rows.length - foundRows.length}</div>
        </div>
        <div class="box">
          <div class="label">Total melhor preço</div>
          <div class="value">R$ ${total.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item da lista</th>
            <th>Produto encontrado</th>
            <th>Marca</th>
            <th>Mercado</th>
            <th>UND</th>
            <th class="money">Qtd</th>
            <th class="money">Melhor preço</th>
            <th class="money">R$/Base</th>
            <th class="money">Subtotal</th>
            <th>Validade</th>
          </tr>
        </thead>
        <tbody>
          ${foundRows.map(({ item, offer, value, subtotal }) => {
            return `
              <tr>
                <td>${item.name}</td>
                <td>${offer?.name}</td>
                <td>${getLikelyBrand(offer?.name || '')}</td>
                <td>${offer?.market}</td>
                <td>${offer?.unit || '-'}</td>
                <td class="money">${item.quantity}</td>
                <td class="money">R$ ${offer?.price.toFixed(2).replace('.', ',')}</td>
                <td class="money">${value ? value.label : '-'}</td>
                <td class="money">R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
                <td>${formatPromotionDate(offer?.endDate)}</td>
              </tr>
            `;
          }).join('')}
          <tr>
            <th colspan="8" class="money">Total</th>
            <th class="money">R$ ${total.toFixed(2).replace('.', ',')}</th>
            <th>${foundRows.length} item(ns)</th>
          </tr>
        </tbody>
      </table>
      <div class="note">
        Lista com apenas o melhor preço encontrado para cada item configurado, como arroz tipo 1, feijão carioca, leite em pó, leite UHT, creme de leite, vinagre, maçã e mamão.
      </div>
    `;

    openPrintableReport(title, bodyHtml, city, subtitle);
  };

  const exportAllFoundPricesPdf = (
    list = shoppingList,
    city = selectedCity,
    title = 'Produtos Encontrados para Escolha Manual',
    subtitle?: string
  ) => {
    if (list.length === 0) {
      alert('Adicione itens na lista de compras antes de gerar o PDF.');
      return;
    }

    const consolidatedList = consolidateShoppingItems(list);
    const itemsWithOffers = [...consolidatedList]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map(item => {
        const offers = getAllOfferOptionsForItem(item.name, city);
        const offerValueDetails = offers.map(offer => ({
          offer,
          value: getProductPackageValue(offer)
        }));
        const comparableValues = offerValueDetails
          .filter(({ value }) => value !== null)
          .map(({ value }) => value?.valuePrice || 0);
        const bestValuePrice = comparableValues.length > 0 ? Math.min(...comparableValues) : null;

        return {
          item,
          offerValueDetails,
          bestValuePrice
        };
      });

    const itemsWithFoundOffers = itemsWithOffers.filter(item => item.offerValueDetails.length > 0);
    const foundOffersCount = itemsWithFoundOffers.reduce((total, item) => total + item.offerValueDetails.length, 0);

    if (itemsWithFoundOffers.length === 0) {
      alert('Nenhum item com preço encontrado para gerar o PDF.');
      return;
    }

    const bodyHtml = `
      <div class="summary">
        <div class="box">
          <div class="label">Itens com preço</div>
          <div class="value">${itemsWithFoundOffers.length}</div>
        </div>
        <div class="box">
          <div class="label">Preços encontrados</div>
          <div class="value">${foundOffersCount}</div>
        </div>
        <div class="box">
          <div class="label">Itens omitidos sem preço</div>
          <div class="value">${consolidatedList.length - itemsWithFoundOffers.length}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Produto da lista</th>
            <th>Produto encontrado</th>
            <th>Marca</th>
            <th>Mercado</th>
            <th>UND</th>
            <th class="money">Qtd</th>
            <th class="money">Preço unit.</th>
            <th class="money">R$/Base</th>
            <th>Vantagem</th>
            <th class="money">Subtotal</th>
            <th>Validade</th>
          </tr>
        </thead>
        <tbody>
          ${itemsWithFoundOffers.map(({ item, offerValueDetails, bestValuePrice }) => {
            return offerValueDetails.map(({ offer, value }, offerIndex) => {
              const isBestValue = value && bestValuePrice !== null && Math.abs(value.valuePrice - bestValuePrice) < 0.001;

              return `
                <tr>
                  <td>${offerIndex === 0 ? item.name : ''}</td>
                  <td>${offer.name}</td>
                  <td>${getLikelyBrand(offer.name)}</td>
                  <td>${offer.market}</td>
                  <td>${offer.unit || '-'}</td>
                  <td class="money">${item.quantity}</td>
                  <td class="money">R$ ${offer.price.toFixed(2).replace('.', ',')}</td>
                  <td class="money">${value ? value.label : '-'}</td>
                  <td>${isBestValue ? '<strong>Mais vantajoso</strong>' : value ? '' : 'Sem base'}</td>
                  <td class="money">R$ ${(offer.price * item.quantity).toFixed(2).replace('.', ',')}</td>
                  <td>${formatPromotionDate(offer.endDate)}</td>
                </tr>
              `;
            }).join('');
          }).join('')}
        </tbody>
      </table>
      <div class="note">
        Relatorio limitado aos itens da lista salva. A coluna R$/Base compara embalagens diferentes por kg, litro ou unidade quando a embalagem é identificada.
      </div>
    `;

    openPrintableReport(title, bodyHtml, city, subtitle);
  };

  const saveCurrentClientPreList = (stayOnSimulator = false) => {
    const clientName = clientNameInput.trim();
    const listName = preListNameInput.trim() || 'Pré-lista principal';

    if (!clientName) {
      alert('Informe o nome do cliente para cadastrar a pré-lista.');
      return;
    }

    if (shoppingList.length === 0) {
      alert('Adicione itens na lista de compras antes de salvar a pré-lista.');
      return;
    }

    const now = new Date().toISOString();
    let savedPreListId = editingPreListId || String(Date.now());
    const normalizedItems = consolidateShoppingItems(shoppingList).map((item, index) => ({
      ...item,
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
    }));

    setClientPreLists(prev => {
      const editingIndex = editingPreListId
        ? prev.findIndex(list => list.id === editingPreListId)
        : -1;
      const sameNameIndex = prev.findIndex(list =>
        normalizeSearchText(list.clientName) === normalizeSearchText(clientName) &&
        normalizeSearchText(list.listName) === normalizeSearchText(listName)
      );
      const existingIndex = editingIndex > -1 ? editingIndex : sameNameIndex;

      const nextList: ClientPreList = {
        id: existingIndex > -1 ? prev[existingIndex].id : savedPreListId,
        clientName,
        listName,
        city: selectedCity,
        items: normalizedItems,
        createdAt: existingIndex > -1 ? prev[existingIndex].createdAt : now,
        updatedAt: now
      };

      savedPreListId = nextList.id;

      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = nextList;
        return next;
      }

      return [nextList, ...prev];
    });

    setPreListSaveStatus(`Pré-lista salva em ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`);

    if (stayOnSimulator) {
      setEditingPreListId(savedPreListId);
      return;
    }

    setClientNameInput('');
    setPreListNameInput('');
    setEditingPreListId(null);
    setActiveTab('prelists');
  };

  const loadClientPreList = (preList: ClientPreList) => {
    setSelectedCity(preList.city);
    setShoppingList(consolidateShoppingItems(preList.items).map((item, index) => ({
      ...item,
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
    })));
    setSelectedOfferIds({});
    setClientNameInput(preList.clientName);
    setPreListNameInput(preList.listName);
    setEditingPreListId(null);
    setPreListSaveStatus('');
    setActiveTab('simulator');
  };

  const editClientPreList = (preList: ClientPreList) => {
    setSelectedCity(preList.city);
    setShoppingList(consolidateShoppingItems(preList.items).map((item, index) => ({
      ...item,
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
    })));
    setSelectedOfferIds({});
    setClientNameInput(preList.clientName);
    setPreListNameInput(preList.listName);
    setEditingPreListId(preList.id);
    setPreListSaveStatus('');
    setActiveTab('simulator');
  };

  const deleteClientPreList = (id: string) => {
    if (!window.confirm('Deseja excluir esta pré-lista do cliente?')) return;
    setClientPreLists(prev => prev.filter(preList => preList.id !== id));
  };

  const exportClientPreListPdf = (preList: ClientPreList) => {
    exportBestPurchasePdf(
      preList.items,
      preList.city,
      'Melhores Precos para Cliente',
      `Cliente: ${preList.clientName} - Pré-lista: ${preList.listName}`
    );
  };

  const exportClientPreListBestPriceByItemPdf = (preList: ClientPreList) => {
    exportBestPriceByItemPdf(
      preList.items,
      preList.city,
      'Melhor Preco de Cada Item',
      `Cliente: ${preList.clientName} - Pré-lista: ${preList.listName}`
    );
  };

  const exportClientPreListAllPricesPdf = (preList: ClientPreList) => {
    exportAllFoundPricesPdf(
      preList.items,
      preList.city,
      'Todos os Precos Encontrados',
      `Cliente: ${preList.clientName} - Pré-lista: ${preList.listName}`
    );
  };

  // Add Item to Shopping List
  const addToShoppingList = (name: string) => {
    if (!name.trim()) return;
    
    const incomingKey = getShoppingItemDuplicateKey({ name });
    const existingIndex = shoppingList.findIndex(item => getShoppingItemDuplicateKey(item) === incomingKey);
    if (existingIndex > -1) {
      const updated = [...shoppingList];
      updated[existingIndex].quantity += 1;
      setShoppingList(consolidateShoppingItems(updated));
    } else {
      setShoppingList(prev => consolidateShoppingItems([...prev, { id: String(Date.now()), name, quantity: 1 }]));
    }
    setCustomItemInput('');
    setSuggestions([]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setShoppingList(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as ShoppingItem[]);
  };

  const removeShoppingItem = (id: string) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    setSelectedOfferIds(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearShoppingList = () => {
    if (window.confirm('Deseja realmente limpar toda a lista de compras?')) {
      setShoppingList([]);
      setSelectedOfferIds({});
    }
  };

  // Find offer in specific market & city (ignoring expired unless no other option)
  const findProductOffer = (itemName: string, marketName: string, city: string): Product | undefined => {
    const marketProducts = products.filter(p => p.market === marketName && (city === 'Todas' || p.city === city));
    if (marketProducts.length === 0) return undefined;

    // Filter out expired items first for validity comparison
    const activeProducts = marketProducts.filter(p => {
      if (!p.endDate) return true;
      return !isDateExpired(p.endDate);
    });

    const targetList = activeProducts;

    const rankedMatches = targetList
      .map(product => ({ product, score: getProductMatchScore(itemName, product) }))
      .filter(({ score }) => score >= 0.45)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return compareProductsByPackageValue(a.product, b.product);
      });

    return rankedMatches[0]?.product;
  };

  const getMarketsForCity = (city: string) =>
    Array.from(new Set(products.filter(p => city === 'Todas' || p.city === city).map(p => p.market)));

  const getItemOfferOptionsForCity = (itemName: string, city: string) => getMarketsForCity(city)
    .map(market => {
      const offer = findProductOffer(itemName, market, city);
      return offer ? { offer, market } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      const packageValueComparison = compareProductsByPackageValue(a.offer, b.offer);
      if (packageValueComparison !== 0) return packageValueComparison;
      return a.market.localeCompare(b.market, 'pt-BR');
    }) as { offer: Product, market: string }[];

  const getAllOfferOptionsForItem = (itemName: string, city: string) => {
    const seenOfferKeys = new Set<string>();

    return products
      .filter(product => city === 'Todas' || product.city === city)
      .filter(product => !isDateExpired(product.endDate))
      .map(product => ({ product, score: getSavedListItemOfferScore(itemName, product) }))
      .filter(({ product, score }) => {
        const offerKey = getProductDuplicateKey(product);
        if (score <= 0 || seenOfferKeys.has(offerKey)) return false;
        seenOfferKeys.add(offerKey);
        return true;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return compareProductsByPackageValue(a.product, b.product);
      })
      .map(({ product }) => product);
  };

  const getItemOfferOptions = (itemName: string) => getItemOfferOptionsForCity(itemName, selectedCity);

  const calculatePurchaseComparison = (
    itemsToCompare: ShoppingItem[],
    city: string,
    offerIds: Record<string, string> = {}
  ) => {
    const consolidatedItems = consolidateShoppingItems(itemsToCompare);
    const marketsForCity = getMarketsForCity(city);
    const marketComparisons: MarketComparison[] = marketsForCity.map(market => {
      let total = 0;
      let availableCount = 0;
      let missingCount = 0;

      const rawItems = consolidatedItems.map(item => {
        const offer = findProductOffer(item.name, market, city);
        const found = !!offer;
        const price = offer ? offer.price : 0;
        const packageValue = offer ? getProductPackageValue(offer) : null;
        const subtotal = price * item.quantity;

        return {
          itemName: item.name,
          catalogName: offer?.name,
          unit: offer?.unit,
          packageValueLabel: packageValue?.label,
          price,
          found,
          quantity: item.quantity,
          subtotal
        };
      });
      const items = mergeRepeatedComparisonItems(rawItems);

      total = items.reduce((sum, item) => sum + item.subtotal, 0);
      availableCount = items.filter(item => item.found).length;
      missingCount = items.filter(item => !item.found).length;

      return {
        marketName: market,
        total,
        availableCount,
        missingCount,
        items
      };
    });

    const sortedMarketComparisons = [...marketComparisons].sort((a, b) => {
      if (a.missingCount !== b.missingCount) {
        return a.missingCount - b.missingCount;
      }
      return a.total - b.total;
    });

    const splitItems: OptimizedItem[] = [];
    let splitTotal = 0;
    let missingCount = 0;

    consolidatedItems.forEach(item => {
      const offers = getItemOfferOptionsForCity(item.name, city);

      if (offers.length > 0) {
        const cheapest = offers[0];
        const selectedOfferId = offerIds[item.id];
        const selectedOffer = selectedOfferId
          ? offers.find(({ offer }) => offer.id === selectedOfferId)
          : undefined;
        const chosen = selectedOffer || cheapest;
        const packageValue = getProductPackageValue(chosen.offer);
        const subtotal = chosen.offer.price * item.quantity;
        splitTotal += subtotal;
        splitItems.push({
          shoppingItemId: item.id,
          offerId: chosen.offer.id,
          name: item.name,
          catalogName: chosen.offer.name,
          unit: chosen.offer.unit,
          packageValueLabel: packageValue?.label,
          quantity: item.quantity,
          price: chosen.offer.price,
          market: chosen.market,
          subtotal,
          city,
          endDate: chosen.offer.endDate,
          selectedManually: !!selectedOffer
        });
      } else {
        missingCount++;
        splitItems.push({
          shoppingItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: 0,
          market: 'Não encontrado',
          subtotal: 0,
          city
        });
      }
    });

    const bestSingleMarket = sortedMarketComparisons.find(m => m.missingCount === 0) || sortedMarketComparisons[0];

    return {
      cityMarkets: marketsForCity,
      allInOneComparisons: marketComparisons,
      optimizedItems: mergeRepeatedOptimizedItems(splitItems),
      optimizedTotal: splitTotal,
      optimizedMissingCount: missingCount,
      bestAllInOne: bestSingleMarket
    };
  };

  // CALCULATE COMPARISONS FOR THE SELECTED CITY
  const currentComparison = useMemo(
    () => calculatePurchaseComparison(shoppingList, selectedCity, selectedOfferIds),
    [shoppingList, selectedCity, selectedOfferIds, products]
  );
  const cityMarkets = currentComparison.cityMarkets;
  const allInOneComparisons = currentComparison.allInOneComparisons;
  const optimizedItems = currentComparison.optimizedItems;
  const optimizedTotal = currentComparison.optimizedTotal;
  const optimizedMissingCount = currentComparison.optimizedMissingCount;
  const bestAllInOne = currentComparison.bestAllInOne;
  const potentialSavings = bestAllInOne && bestAllInOne.total > 0 ? (bestAllInOne.total - optimizedTotal) : 0;

  // Filter Catalog
  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesSearch = !searchTerm.trim() || getProductMatchScore(searchTerm, p) >= 0.45;
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesProductGroup = selectedProductGroup === 'Todos' || getProductGroup(p.name, p.unit) === selectedProductGroup;
    const matchesMarket = selectedMarket === 'Todos' || p.market === selectedMarket;
    const matchesCity = selectedCity === 'Todas' || p.city === selectedCity;
    return matchesSearch && matchesCategory && matchesProductGroup && matchesMarket && matchesCity;
  }), [products, searchTerm, selectedCategory, selectedProductGroup, selectedMarket, selectedCity]);

  const productsMatchingFiltersWithoutExpiry = useMemo(() => products.filter(p => {
    const matchesSearch = !searchTerm.trim() || getProductMatchScore(searchTerm, p) >= 0.45;
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesProductGroup = selectedProductGroup === 'Todos' || getProductGroup(p.name, p.unit) === selectedProductGroup;
    const matchesMarket = selectedMarket === 'Todos' || p.market === selectedMarket;
    const matchesCity = selectedCity === 'Todas' || p.city === selectedCity;
    return matchesSearch && matchesCategory && matchesProductGroup && matchesMarket && matchesCity;
  }), [products, searchTerm, selectedCategory, selectedProductGroup, selectedMarket, selectedCity]);

  const exportProductsPdf = () => {
    const sourceProducts = productsMatchingFiltersWithoutExpiry.length > 0
      ? productsMatchingFiltersWithoutExpiry
      : products;

    if (sourceProducts.length === 0) {
      alert('Nenhum produto cadastrado para gerar PDF.');
      return;
    }

    const formatDate = (value?: string) => {
      if (!value) return 'Sem validade';
      const [year, month, day] = value.split('-');
      return year && month && day ? `${day}/${month}/${year}` : value;
    };

    const rowsHtml = `
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Marca</th>
            <th>Mercado</th>
            <th>Valor</th>
            <th>Vcto Promocao</th>
          </tr>
        </thead>
        <tbody>
          ${[...sourceProducts]
            .sort((a, b) =>
              a.name.localeCompare(b.name, 'pt-BR') ||
              a.market.localeCompare(b.market, 'pt-BR') ||
              a.price - b.price
            )
            .map(product => `
            <tr>
              <td>${product.name}</td>
              <td>${getLikelyBrand(product.name)}</td>
              <td>${product.market}</td>
              <td>R$ ${product.price.toFixed(2).replace('.', ',')}</td>
              <td>${formatDate(product.endDate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('O navegador bloqueou a janela do PDF. Permita pop-ups para este site.');
      return;
    }
    const pdfFileName = getPricesPdfFileName();

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${pdfFileName}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            h2 { font-size: 15px; margin: 18px 0 8px; color: #111827; }
            .meta { font-size: 11px; color: #4b5563; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; break-inside: auto; page-break-inside: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th, td { border: 1px solid #d1d5db; padding: 6px 7px; font-size: 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
            td:nth-child(4), th:nth-child(4) { text-align: right; white-space: nowrap; }
            td:nth-child(5), th:nth-child(5) { white-space: nowrap; }
          </style>
        </head>
        <body>
          <h1>Listagem de Produtos por Ordem Alfabetica</h1>
          <div class="meta">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} - ${sourceProducts.length} produtos listados
          </div>
          ${rowsHtml}
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  const exportManualQuotePreListPdf = (preList: ClientPreList) => {
    const sourceItems = consolidateShoppingItems(preList.items);

    if (sourceItems.length === 0) {
      alert('Esta pré-lista não tem itens para gerar o PDF de orçamento manual.');
      return;
    }

    const quoteItems = sourceItems
      .map(item => ({
        item,
        displayName: item.name
      }))
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'pt-BR')
      );

    const rowsHtml = `
      <div class="quote-header">
        <div><strong>Cliente:</strong> ${escapeHtml(preList.clientName)} <strong>Pré-lista:</strong> ${escapeHtml(preList.listName)}</div>
        <div><strong>Cidade:</strong> ${escapeHtml(preList.city)}</div>
        <div><strong>Mercado:</strong> ________________________________________________</div>
        <div><strong>Responsável:</strong> _______________________ <strong>Data:</strong> ____/____/______</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd Lista</th>
            <th>UND</th>
            <th class="write-cell">Qtd Caixa Master</th>
            <th class="write-cell">Valor Unit.</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          ${quoteItems.map(({ item, displayName }) => `
            <tr>
              <td>${escapeHtml(displayName)}</td>
              <td>${escapeHtml(item.quantity)}</td>
              <td>&nbsp;</td>
              <td class="write-cell">&nbsp;</td>
              <td class="write-cell">&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="note">
        Cotação manual referente somente à pré-lista selecionada: preencher quantidade por caixa master, valor unitário e observações do mercado.
      </div>
    `;

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('O navegador bloqueou a janela do PDF. Permita pop-ups para este site.');
      return;
    }
    const pdfFileName = getPricesPdfFileName();

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${pdfFileName}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            .meta, .note { font-size: 11px; color: #4b5563; margin-bottom: 12px; }
            .quote-header {
              display: grid;
              gap: 7px;
              border: 1px solid #d1d5db;
              padding: 9px;
              margin: 12px 0;
              font-size: 12px;
            }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; break-inside: auto; page-break-inside: auto; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th, td { border: 1px solid #9ca3af; padding: 6px 7px; font-size: 10px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 700; }
            td:nth-child(2), th:nth-child(2) { text-align: center; white-space: nowrap; }
            td:nth-child(3), th:nth-child(3) { white-space: nowrap; }
            .write-cell { width: 82px; text-align: center; }
            tbody td.write-cell { height: 24px; }
          </style>
        </head>
        <body>
          <h1>Orçamento Manual de Produtos</h1>
          <div class="meta">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} - ${quoteItems.length} itens da pré-lista
          </div>
          ${rowsHtml}
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  const exportBestPricesPdf = () => {
    const sourceProducts = filteredProducts;

    if (sourceProducts.length === 0) {
      alert('Nenhuma oferta encontrada para gerar a lista de melhores preços.');
      return;
    }

    const formatDate = (value?: string) => {
      if (!value) return 'Sem validade';
      const [year, month, day] = value.split('-');
      return year && month && day ? `${day}/${month}/${year}` : value;
    };

    const bestByGroup = Array.from(
      sourceProducts.reduce((acc, product) => {
        const group = getProductGroup(product.name, product.unit);
        const currentBest = acc.get(group);
        if (
          !currentBest ||
          compareProductsByPackageValue(product, currentBest) < 0
        ) {
          acc.set(group, product);
        }
        return acc;
      }, new Map<string, Product>())
    )
      .map(([group, product]) => ({ group, product }))
      .sort((a, b) =>
        a.product.market.localeCompare(b.product.market, 'pt-BR') ||
        a.group.localeCompare(b.group, 'pt-BR')
      );

    const bestByMarket = Array.from(
      bestByGroup.reduce((acc, item) => {
        const marketItems = acc.get(item.product.market) || [];
        marketItems.push(item);
        acc.set(item.product.market, marketItems);
        return acc;
      }, new Map<string, { group: string, product: Product }[]>())
    )
      .map(([market, items]) => ({
        market,
        items: items.sort((a, b) => a.group.localeCompare(b.group, 'pt-BR')),
        subtotal: items.reduce((sum, item) => sum + item.product.price, 0)
      }))
      .sort((a, b) => a.market.localeCompare(b.market, 'pt-BR'));

    const grandTotal = bestByMarket.reduce((sum, marketGroup) => sum + marketGroup.subtotal, 0);

    const rowsHtml = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Produto encontrado</th>
            <th>UND</th>
            <th>Cidade</th>
            <th>Melhor valor</th>
            <th>R$/Base</th>
            <th>Validade da promocao</th>
          </tr>
        </thead>
        <tbody>
          ${bestByMarket.map(({ market, items, subtotal }) => `
            <tr class="market-row">
              <td colspan="6">${market}</td>
            </tr>
            ${items.map(({ group, product }) => `
            <tr>
              <td>${group}</td>
              <td>${product.name}</td>
              <td>${product.unit}</td>
              <td>${product.city}</td>
              <td>${formatCurrency(product.price)}</td>
              <td>${getProductPackageValue(product)?.label || '-'}</td>
              <td>${formatDate(product.endDate)}</td>
            </tr>
            `).join('')}
            <tr class="subtotal-row">
              <td colspan="4">Subtotal ${market}</td>
              <td>${formatCurrency(subtotal)}</td>
              <td colspan="2">${items.length} item(ns)</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="4">Total geral</td>
            <td>${formatCurrency(grandTotal)}</td>
            <td colspan="2">${bestByGroup.length} item(ns)</td>
          </tr>
        </tbody>
      </table>
    `;

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('O navegador bloqueou a janela da lista. Permita pop-ups para este site.');
      return;
    }
    const pdfFileName = getPricesPdfFileName();

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${pdfFileName}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            .meta { font-size: 11px; color: #4b5563; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 7px; font-size: 10px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 700; }
            td:nth-child(3), th:nth-child(3) { white-space: nowrap; }
            td:nth-child(5), th:nth-child(5) { text-align: right; white-space: nowrap; }
            td:nth-child(6), th:nth-child(6) { text-align: right; white-space: nowrap; }
            td:nth-child(7), th:nth-child(7) { white-space: nowrap; }
            .market-row td { background: #e5e7eb; font-weight: 700; font-size: 12px; color: #111827; }
            .subtotal-row td { background: #f9fafb; font-weight: 700; }
            .total-row td { background: #111827; color: white; font-weight: 700; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>Melhores Precos por Item</h1>
          <div class="meta">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} - ${bestByGroup.length} itens agrupados
          </div>
          ${rowsHtml}
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header glass-panel">
        <div className="header-title-group">
          <div className="logo-icon">
            <ShoppingCart />
          </div>
          <div>
            <h1 className="app-title">Radar de Preços</h1>
            <p className="app-subtitle">Compare folhetos e links em Ourinhos e Região</p>
          </div>
        </div>

        {/* API Key Configuration */}
        <div className="api-config-container">
          <Key size={18} className="text-secondary-color" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input 
              type={showApiKey ? 'text' : 'password'} 
              placeholder="Gemini API Key" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              className="input-glow"
              style={{ width: '250px' }}
            />
            <button
              type="button"
              className="btn-icon"
              title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
              onClick={() => setShowApiKey(prev => !prev)}
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <a 
            href="https://aistudio.google.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            title="Clique para obter uma chave de API gratuita no Google AI Studio"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Info size={16} className="text-secondary-color" />
          </a>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          <ShoppingCart size={18} />
          Simulador de Compras
        </button>
        <button 
          className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <Filter size={18} />
          Catálogo ({products.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'prelists' ? 'active' : ''}`}
          onClick={() => setActiveTab('prelists')}
        >
          <FileTextIcon size={18} />
          Pré-listas ({clientPreLists.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={18} />
          Importar Ofertas
        </button>
      </div>

      {/* City selector in control bar */}
      <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Globe className="text-success" size={20} />
          <span style={{ fontWeight: '700' }}>Cidade de Cobertura Ativa:</span>
          <select 
            className="select-filter" 
            value={selectedCity} 
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
            {cities.indexOf('Ourinhos') === -1 && <option value="Ourinhos">Ourinhos</option>}
          </select>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Data Atual: <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
        </div>
      </div>

      {/* Main panels based on Tab */}
      {activeTab === 'upload' && (
        <div className="upload-grid">
          <div className="glass-panel">
            <h2 className="product-name" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Enviar Ofertas</h2>
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              borderRadius: '8px',
              background: apiKey.trim() ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: apiKey.trim() ? '1px solid rgba(16, 185, 129, 0.24)' : '1px solid rgba(245, 158, 11, 0.28)'
            }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
                Chave Gemini para ler imagens, PDFs e buscas online
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Cole aqui sua Gemini API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-glow"
                  style={{ flex: '1 1 320px', minWidth: 0 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowApiKey(prev => !prev)}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showApiKey ? 'Ocultar' : 'Mostrar'}
                </button>
                <a
                  className="btn-secondary"
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  Gerar chave
                </a>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.55rem' }}>
                {apiKey.trim() ? 'Chave salva neste navegador.' : 'Sem a chave, PDF com texto pode funcionar, mas imagem, foto e busca online precisam da IA.'}
              </p>
            </div>
            <div style={{
              marginBottom: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: 'rgba(37, 211, 102, 0.1)',
              border: '1px solid rgba(37, 211, 102, 0.22)',
              fontSize: '0.85rem',
              color: 'var(--text-primary)'
            }}>
              <strong>Coletor automático:</strong> {whatsAppBridgeStatus}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                Recebe ofertas pelo WhatsApp {whatsAppCollectorConfig?.ownerWhatsAppNumber || '14988359798'} e salva PDFs/imagens em {whatsAppCollectorConfig?.receivedWhatsAppFolder || 'ENTRADA_OFERTAS\\WhatsApp'}.
              </div>
              {whatsAppCollectorConfig && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem' }}>
                  {whatsAppCollectorConfig.monitoredMarkets.map(({ market, phones }) => (
                    <span
                      key={market}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.28rem 0.5rem',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)'
                      }}
                      title={phones.join(' / ')}
                    >
                      <CheckCircle size={12} />
                      {market}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Import Method selection */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className={`tab-btn ${importMethod === 'online' ? 'active' : ''}`}
                onClick={() => setImportMethod('online')}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <Globe size={14} style={{ marginRight: '4px' }} /> Varredura Online
              </button>
              <button 
                type="button"
                className={`tab-btn ${importMethod === 'pdf' ? 'active' : ''}`}
                onClick={() => setImportMethod('pdf')}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <FileTextIcon size={14} style={{ marginRight: '4px' }} /> PDF
              </button>
              <button 
                type="button"
                className={`tab-btn ${importMethod === 'image' ? 'active' : ''}`}
                onClick={() => setImportMethod('image')}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <ImageIcon size={14} style={{ marginRight: '4px' }} /> Foto/Imagem
              </button>
              <button 
                type="button"
                className={`tab-btn ${importMethod === 'url' ? 'active' : ''}`}
                onClick={() => setImportMethod('url')}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <LinkIcon size={14} style={{ marginRight: '4px' }} /> Link da Loja
              </button>
              <button 
                type="button"
                className={`tab-btn ${importMethod === 'text' ? 'active' : ''}`}
                onClick={() => setImportMethod('text')}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <Filter size={14} style={{ marginRight: '4px' }} /> Copiar e Colar Texto
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Supermercado:</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Pão de Açúcar, Mambo..." 
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    className="input-glow"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Cidade:</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Ourinhos" 
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    className="input-glow"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Validity fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Validade - Início (Opcional):</label>
                  <input 
                    type="date" 
                    value={manualStartDate}
                    onChange={(e) => setManualStartDate(e.target.value)}
                    className="input-glow"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Validade - Fim (Opcional):</label>
                  <input 
                    type="date" 
                    value={manualEndDate}
                    onChange={(e) => setManualEndDate(e.target.value)}
                    className="input-glow"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {importMethod === 'online' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Termo de busca (Opcional - ex: "cerveja", "arroz" ou deixe em branco para ofertas gerais):
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: cerveja, frango, leite... ou deixe em branco" 
                      value={onlineSearchQuery}
                      onChange={(e) => setOnlineSearchQuery(e.target.value)}
                      className="input-glow"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleOnlineSearch}
                    disabled={uploading}
                    style={{ justifyContent: 'center' }}
                  >
                    Iniciar busca online de preços
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    * O Gemini fará uma busca em tempo real na internet por encartes, folhetos e sites oficiais de supermercados de {cityInput} (como Amigão, Avenida, Maitan, Max Atacadista, etc.) e extrairá as ofertas ativas.
                  </p>
                </div>
              )}

              {importMethod === 'pdf' && (
                <label className="dropzone-container">
                  <Upload size={40} className="dropzone-icon" />
                  <div>
                    <p style={{ fontWeight: '600' }}>Selecione os arquivos PDF de Ourinhos</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Arraste ou clique para navegar (múltiplos permitidos)</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    multiple
                    onChange={handlePdfUpload} 
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
              )}

              {importMethod === 'image' && (
                <label className="dropzone-container">
                  <ImageIcon size={40} className="dropzone-icon" />
                  <div>
                    <p style={{ fontWeight: '600' }}>Selecione as Imagens/Fotos da oferta</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Arraste ou clique para navegar (múltiplas permitidas)</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    onChange={handleImageUpload} 
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
              )}

              {importMethod === 'url' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input 
                    type="url" 
                    placeholder="Cole o Link/URL da página de ofertas (ex: https://site.com/ofertas)..." 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="input-glow"
                  />
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleUrlImport}
                    disabled={uploading}
                    style={{ justifyContent: 'center' }}
                  >
                    Buscar e Extrair do Link
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    * Caso ocorra restrição de acesso (CORS), utilize o método "Copiar e Colar Texto" abrindo o site, selecionando todo o texto e colando aqui.
                  </p>
                </div>
              )}

              {importMethod === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <textarea 
                    placeholder="Selecione tudo (Ctrl+A), copie (Ctrl+C) o texto da página de ofertas e cole aqui..." 
                    value={manualTextInput}
                    onChange={(e) => setManualTextInput(e.target.value)}
                    className="input-glow"
                    rows={8}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleTextImport}
                    disabled={uploading}
                    style={{ justifyContent: 'center' }}
                  >
                    Processar Texto Colado
                  </button>
                </div>
              )}

              {uploadStatus && (
                <div style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {uploading ? (
                    <div className="loader" style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid var(--accent-primary)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  ) : <CheckCircle size={16} className="text-success" />}
                  <span>{uploadStatus}</span>
                </div>
              )}

              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Deseja carregar produtos fictícios para demonstração?</p>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  onClick={() => {
                    const market = marketName.trim() || 'Supermercado Demo';
                    const city = cityInput.trim() || 'Ourinhos';
                    const demoOffers = generateDemoOffers(market, city);
                    setProducts(prev => removeExpiredProducts([...prev, ...demoOffers]));
                    const activeDemoOffers = removeExpiredProducts(demoOffers);
                    setUploadStatus(activeDemoOffers.length > 0
                      ? `Demo: ${activeDemoOffers.length} ofertas adicionadas para ${market} (${city}).`
                      : 'Nenhuma oferta válida foi adicionada. Ofertas vencidas são excluídas automaticamente.'
                    );
                  }}
                >
                  Carregar Dados de Demonstração
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <h2 className="product-name" style={{ fontSize: '1.4rem', marginBottom: '1.2rem' }}>Folhetos & Cidades Cadastradas</h2>
            
            {products.length === 0 ? (
              <p className="text-secondary-color">Nenhum mercado cadastrado.</p>
            ) : (
              <div className="brochures-list">
                {Array.from(new Set(products.map(p => `${p.market}||${p.city}`))).map(item => {
                  const [m, c] = item.split('||');
                  const marketProducts = products.filter(p => p.market === m && p.city === c);
                  const firstProd = marketProducts[0];
                  const datesText = firstProd && firstProd.startDate && firstProd.endDate 
                    ? `${firstProd.startDate.split('-').reverse().slice(0,2).join('/')} a ${firstProd.endDate.split('-').reverse().slice(0,2).join('/')}`
                    : 'Sem data';

                  return (
                    <div key={item} className="brochure-card">
                      <div>
                        <h4 style={{ fontWeight: '700' }}>{m} ({c})</h4>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>{marketProducts.length} itens</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={12} /> {datesText}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn-icon text-danger" 
                        onClick={() => {
                          if (window.confirm(`Deseja remover ofertas de ${m} na cidade ${c}?`)) {
                            setProducts(prev => prev.filter(p => !(p.market === m && p.city === c)));
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="glass-panel">
          <div className="catalog-filters">
            <div className="search-input" style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-secondary)' }} size={16} />
              <input 
                type="text" 
                placeholder="Buscar produto ou categoria..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-glow"
                style={{ width: '100%', paddingLeft: '2.2rem' }}
              />
            </div>

            <select 
              className="select-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select 
              className="select-filter"
              value={selectedProductGroup}
              onChange={(e) => setSelectedProductGroup(e.target.value)}
            >
              {productGroups.map(group => (
                <option key={group} value={group}>
                  {group === 'Todos' ? 'Todos os Produtos' : group}
                </option>
              ))}
            </select>

            <select 
              className="select-filter"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
            >
              <option value="Todos">Todos os Mercados</option>
              {markets.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select 
              className="select-filter"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="Todas">Todas as Cidades</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button
              className="btn-secondary"
              onClick={exportProductsPdf}
              disabled={products.length === 0}
            >
              <FileTextIcon size={16} /> Gerar PDF
            </button>

            <button
              className="btn-secondary"
              onClick={exportBestPricesPdf}
              disabled={products.length === 0}
            >
              <TrendingDown size={16} /> Melhores Preços
            </button>

            {products.length > 0 && (
              <button 
                className="btn-secondary" 
                style={{ color: 'var(--accent-danger)' }}
                onClick={() => {
                  if (window.confirm('Limpar todas as ofertas importadas?')) {
                    setProducts([]);
                  }
                }}
              >
                Limpar Tudo
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <p>Nenhuma oferta encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map(p => {
                const validity = getValidityStatus(p.endDate);
                
                return (
                  <div key={p.id} className="glass-panel product-card">
                    <span className="product-market-badge">{p.market}</span>
                    <span className="product-category-badge">{p.category}</span>
                    <h3 className="product-name" style={{ minHeight: '3.3rem' }}>{p.name}</h3>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                      <Globe size={12} className="text-secondary-color" />
                      <span className="text-secondary-color">{p.city}</span>
                      <span>•</span>
                      <span className={`validity-badge ${validity.type}`} style={{
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        backgroundColor: validity.type === 'expired' ? 'rgba(239, 68, 68, 0.2)' : 
                                         validity.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: validity.type === 'expired' ? 'var(--accent-danger)' :
                               validity.type === 'warning' ? 'var(--accent-warning)' : 'var(--accent-success)'
                      }}>
                        {validity.label}
                      </span>
                    </div>

                    <div className="product-price-row">
                      <span className="product-price">R$ {p.price.toFixed(2)}</span>
                      <span className="product-unit">Unidade: {p.unit}</span>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', marginTop: '1.2rem', justifyContent: 'center', padding: '0.5rem' }}
                      onClick={() => addToShoppingList(p.name)}
                    >
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prelists' && (
        <div className="glass-panel">
          <div className="flex-between prelist-header">
            <div>
              <h2 className="product-name" style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>Pré-listas por Cliente</h2>
              <p className="text-secondary-color" style={{ fontSize: '0.85rem' }}>
                Cadastre listas recorrentes por cliente e gere o PDF com os melhores preços quando precisar.
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => setActiveTab('simulator')}
            >
              <Plus size={16} /> Nova pré-lista
            </button>
          </div>

          {clientPreLists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <FileTextIcon size={40} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
              <p>Nenhuma pré-lista cadastrada.</p>
              <p style={{ fontSize: '0.75rem' }}>Monte uma lista no simulador e salve para um cliente.</p>
            </div>
          ) : (
            <div className="prelist-grid">
              {clientPreLists.map(preList => {
                const comparison = calculatePurchaseComparison(preList.items, preList.city);
                const updatedAt = new Date(preList.updatedAt).toLocaleDateString('pt-BR');

                return (
                  <div key={preList.id} className="prelist-card">
                    <div className="prelist-card-top">
                      <div>
                        <div className="product-category-badge">{preList.city}</div>
                        <h3 className="product-name" style={{ marginBottom: '0.3rem' }}>{preList.clientName}</h3>
                        <p className="text-secondary-color" style={{ fontSize: '0.82rem' }}>{preList.listName}</p>
                      </div>
                      <button
                        className="btn-icon text-danger"
                        title="Excluir pré-lista"
                        onClick={() => deleteClientPreList(preList.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="prelist-summary">
                      <div>
                        <span className="metric-label">Itens</span>
                        <strong>{preList.items.length}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Melhores preços</span>
                        <strong className="text-success">R$ {comparison.optimizedTotal.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Atualizada</span>
                        <strong>{updatedAt}</strong>
                      </div>
                    </div>

                    <div className="prelist-items-preview">
                      {preList.items.slice(0, 4).map(item => (
                        <span key={item.id}>{item.quantity}x {item.name}</span>
                      ))}
                      {preList.items.length > 4 && (
                        <span>+ {preList.items.length - 4} item(ns)</span>
                      )}
                    </div>

                    <div className="prelist-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => loadClientPreList(preList)}
                      >
                        <ShoppingCart size={16} /> Carregar
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => editClientPreList(preList)}
                      >
                        <Pencil size={16} /> Editar
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => exportClientPreListPdf(preList)}
                      >
                        <TrendingDown size={16} /> PDF melhores preços
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => exportClientPreListBestPriceByItemPdf(preList)}
                      >
                        <CheckCircle size={16} /> PDF melhor por item
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => exportManualQuotePreListPdf(preList)}
                      >
                        <Pencil size={16} /> PDF orçamento manual
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => exportClientPreListAllPricesPdf(preList)}
                      >
                        <FileTextIcon size={16} /> PDF todos preços
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'simulator' && (
        <div className="simulator-layout">
          {/* Left panel: Build shopping list */}
          <div className="glass-panel">
            <h2 className="product-name" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Sua Lista de Compras ({selectedCity})</h2>
            <p className="text-secondary-color mb-1" style={{ fontSize: '0.85rem' }}>
              Adicione os itens que você deseja comprar. O simulador buscará automaticamente os preços nos mercados de {selectedCity}.
            </p>

            <form
              style={{ position: 'relative', marginTop: '1.5rem', zIndex: 2 }}
              onSubmit={(e) => {
                e.preventDefault();
                addToShoppingList(customItemInput);
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input 
                  type="text" 
                  name="shopping-product-search"
                  placeholder="Digite o nome do produto (ex: Arroz)..." 
                  value={customItemInput}
                  onChange={(e) => setCustomItemInput(e.target.value)}
                  className="input-glow"
                  autoComplete="off"
                  style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 3 }}
                />
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Adicionar
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="suggestions-box">
                  {suggestions.map(s => (
                    <div 
                      key={s} 
                      className="suggestion-item"
                      onClick={() => addToShoppingList(s)}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* Quick list suggestions */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Sugestões rápidas:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {['Arroz', 'Feijão', 'Leite', 'Cerveja', 'Alcatra', 'Detergente'].map(sugg => (
                  <button 
                    key={sugg} 
                    className="btn-secondary" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => addToShoppingList(sugg)}
                  >
                    + {sugg}
                  </button>
                ))}
              </div>
            </div>

            <div className="client-prelist-box">
              <p style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.65rem' }}>
                {editingPreListId ? 'Editando pré-lista do cliente' : 'Cadastrar pré-lista para cliente'}
              </p>
              <div className="client-prelist-form">
                <input
                  type="text"
                  name="client-name"
                  placeholder="Nome do cliente"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="input-glow"
                />
                <input
                  type="text"
                  name="prelist-name"
                  placeholder="Nome da pré-lista (opcional)"
                  value={preListNameInput}
                  onChange={(e) => setPreListNameInput(e.target.value)}
                  className="input-glow"
                />
                <button
                  className="btn-primary"
                  onClick={() => saveCurrentClientPreList()}
                >
                  {editingPreListId ? <CheckCircle size={16} /> : <Plus size={16} />}
                  {editingPreListId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
              {preListSaveStatus && (
                <p className="text-success" style={{ fontSize: '0.78rem', marginTop: '0.55rem', fontWeight: '700' }}>
                  {preListSaveStatus}
                </p>
              )}
              {editingPreListId && (
                <button
                  className="btn-secondary"
                  style={{ marginTop: '0.6rem' }}
                  onClick={() => {
                    setEditingPreListId(null);
                    setClientNameInput('');
                    setPreListNameInput('');
                    setPreListSaveStatus('');
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>

            {shoppingList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
                <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>Sua lista está vazia.</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione produtos acima para começar.</p>
              </div>
            ) : (
              <div>
                <div className="shopping-list-toolbar">
                  <span>{shoppingList.length} produtos na lista</span>
                  <button
                    className="btn-secondary clear-products-btn"
                    onClick={clearShoppingList}
                    title="Limpar todos os produtos da lista"
                  >
                    <Trash2 size={16} />
                    Limpar produtos
                  </button>
                </div>
                <div className="added-items-list">
                  {shoppingList.map(item => (
                    <div key={item.id} className="shopping-item-row">
                      <span style={{ fontWeight: '600' }}>{item.name}</span>
                      <div className="quantity-controls">
                        <button className="btn-icon" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus size={14} />
                        </button>
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: '700' }}>
                          {item.quantity}
                        </span>
                        <button className="btn-icon" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus size={14} />
                        </button>
                        <button 
                          className="btn-icon text-danger" 
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => removeShoppingItem(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* WhatsApp Quick Import UI */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🟢 Importar Lista do WhatsApp (Texto)
                  </p>
                  <textarea 
                    placeholder="Cole o texto da conversa (ex: Amor, traz 2 leites, arroz e 3 cervejas)..."
                    value={whatsAppText}
                    onChange={(e) => setWhatsAppText(e.target.value)}
                    className="input-glow"
                    rows={2}
                    style={{ width: '100%', fontSize: '0.8rem', resize: 'vertical' }}
                  />
                  <button 
                    className="btn-secondary" 
                    style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.8rem' }}
                    onClick={handleImportWhatsAppList}
                    disabled={uploading}
                  >
                    Extrair Itens com IA
                  </button>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {editingPreListId && (
                    <button
                      className="btn-primary"
                      onClick={() => saveCurrentClientPreList(true)}
                    >
                      <CheckCircle size={16} /> Salvar edição da pré-lista
                    </button>
                  )}
                  <button className="btn-secondary" style={{ color: 'var(--accent-danger)' }} onClick={clearShoppingList}>
                    Limpar Lista
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Comparison Dashboard */}
          <div className="results-dashboard">
            {shoppingList.length === 0 ? (
              <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', minHeight: '300px' }}>
                <Info size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>Insira itens na lista para ver o comparativo de preços.</p>
              </div>
            ) : (
              <>
                {/* Highlights */}
                <div className="comparison-grid">
                  {/* Split optimized purchase (Buy best prices split) */}
                  <div className="glass-panel comparison-card split-optimized">
                    <div className="flex-between">
                      <span className="metric-label">Compra Inteligente (Dividida)</span>
                      <TrendingDown className="text-success" size={20} />
                    </div>
                    <h3 className="metric-value text-success">
                      R$ {optimizedTotal.toFixed(2)}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Comprando o item mais barato de {selectedCity}.
                      {optimizedMissingCount > 0 && ` (${optimizedMissingCount} itens ausentes)`}
                    </p>
                    {potentialSavings > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.4rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--accent-success)', fontWeight: '700', textAlign: 'center' }}>
                        Economia de R$ {potentialSavings.toFixed(2)}!
                      </div>
                    )}
                  </div>

                  {/* Best Single Market */}
                  {bestAllInOne && (
                    <div className="glass-panel comparison-card cheapest">
                      <div className="flex-between">
                        <span className="metric-label">Comprar tudo em um</span>
                        <CheckCircle className="text-success" size={20} />
                      </div>
                      <h3 className="metric-value">
                        R$ {bestAllInOne.total.toFixed(2)}
                      </h3>
                      <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'white' }}>
                        Melhor opção única: {bestAllInOne.marketName}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {bestAllInOne.availableCount} de {shoppingList.length} itens encontrados.
                      </p>
                    </div>
                  )}
                </div>

                {/* WhatsApp Share Button */}
                <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={exportPurchaseByMarketPdf}
                    style={{ justifyContent: 'center', fontWeight: '700' }}
                  >
                    <FileTextIcon size={16} /> PDF Compra por Mercado
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => exportBestPurchasePdf()}
                    style={{ justifyContent: 'center', fontWeight: '700' }}
                  >
                    <TrendingDown size={16} /> PDF Melhores Preços
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => exportBestPriceByItemPdf()}
                    style={{ justifyContent: 'center', fontWeight: '700' }}
                  >
                    <CheckCircle size={16} /> PDF Melhor por Item
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={shareListOnWhatsApp}
                    style={{ gridColumn: '1 / -1', width: '100%', justifyContent: 'center', backgroundColor: '#25D366', color: 'white', fontWeight: '700' }}
                  >
                    💬 Enviar Lista Comparativa para o WhatsApp
                  </button>
                </div>

                {/* All markets comparison chart */}
                <div className="glass-panel">
                  <h3 className="product-name" style={{ fontSize: '1.1rem' }}>Comparação de Totais ({selectedCity})</h3>
                  
                  {cityMarkets.length === 0 ? (
                    <p className="text-secondary-color" style={{ fontSize: '0.85rem' }}>Nenhum mercado cadastrado para {selectedCity}.</p>
                  ) : (
                    <div className="custom-bar-chart">
                      {/* Optimized row */}
                      <div className="chart-bar-row">
                        <div className="chart-label" style={{ fontWeight: '700', color: 'var(--accent-success)' }}>Compra Dividida</div>
                        <div className="chart-bar-container">
                          <div 
                            className="chart-bar-fill optimized"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div className="chart-value text-success">R$ {optimizedTotal.toFixed(2)}</div>
                      </div>

                      {/* Other markets */}
                      {allInOneComparisons.map(comparison => {
                        const percent = comparison.total > 0 
                          ? Math.min(100, (optimizedTotal / comparison.total) * 100)
                          : 0;

                        return (
                          <div key={comparison.marketName} className="chart-bar-row">
                            <div className="chart-label">{comparison.marketName}</div>
                            <div className="chart-bar-container">
                              <div 
                                className="chart-bar-fill"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="chart-value">
                              {comparison.total > 0 ? `R$ ${comparison.total.toFixed(2)}` : 'N/A'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Item-by-item breakdown */}
                <div className="glass-panel">
                  <h3 className="product-name" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Análise por Item em {selectedCity}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Veja abaixo onde comprar cada produto da sua lista:
                  </p>

                  <div className="items-breakdown-list">
                    {optimizedItems.map((optItem, idx) => {
                      const isFound = optItem.market !== 'Não encontrado';
                      const validity = getValidityStatus(optItem.endDate);
                      const offerOptions = getItemOfferOptions(optItem.name);
                      const selectedOfferId = selectedOfferIds[optItem.shoppingItemId];
                      const selectedOfferExists = offerOptions.some(({ offer }) => offer.id === selectedOfferId);
                      
                      return (
                        <div key={idx} className={`breakdown-row ${isFound ? 'highlighted' : ''}`} style={{ flexDirection: 'column', gap: '0.65rem' }}>
                          <div className="item-choice-summary">
                            <div>
                              <div>
                                <span style={{ fontWeight: '700' }}>{optItem.quantity}x</span> {optItem.name}
                              </div>
                              {optItem.catalogName && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                  Oferta: {optItem.catalogName}
                                </div>
                              )}
                            </div>
                            {isFound ? (
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ color: 'var(--accent-success)', fontWeight: '700', marginRight: '0.5rem' }}>
                                  {formatCurrency(optItem.price)}
                                </span>
                                {optItem.packageValueLabel && (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginRight: '0.5rem' }}>
                                    {optItem.packageValueLabel}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.08)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                  no {optItem.market}
                                </span>
                                {optItem.selectedManually && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--accent-warning)', marginTop: '0.25rem', fontWeight: '700' }}>
                                    Selecionado por você
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-danger" style={{ fontSize: '0.85rem' }}>
                                Não encontrado
                              </span>
                            )}
                          </div>

                          {isFound && (
                            <div className="item-choice-controls">
                              <select
                                className="select-filter offer-select"
                                value={selectedOfferExists ? selectedOfferId : 'auto'}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSelectedOfferIds(prev => {
                                    const next = { ...prev };
                                    if (value === 'auto') {
                                      delete next[optItem.shoppingItemId];
                                    } else {
                                      next[optItem.shoppingItemId] = value;
                                    }
                                    return next;
                                  });
                                }}
                                aria-label={`Selecionar melhor preço para ${optItem.name}`}
                              >
                                <option value="auto">
                                  Melhor custo automático: {formatCurrency(offerOptions[0]?.offer.price || optItem.price)}{getProductPackageValue(offerOptions[0]?.offer || ({ name: optItem.catalogName || optItem.name, unit: optItem.unit || '', price: optItem.price } as Product))?.label ? ` (${getProductPackageValue(offerOptions[0]?.offer || ({ name: optItem.catalogName || optItem.name, unit: optItem.unit || '', price: optItem.price } as Product))?.label})` : ''} - {offerOptions[0]?.market || optItem.market} - {formatPromotionDate(offerOptions[0]?.offer.endDate || optItem.endDate)}
                                </option>
                                {offerOptions.map(({ offer, market }) => (
                                  <option key={offer.id} value={offer.id}>
                                    {formatCurrency(offer.price)}{getProductPackageValue(offer)?.label ? ` (${getProductPackageValue(offer)?.label})` : ''} - {market} - {formatPromotionDate(offer.endDate)} - {offer.name}
                                  </option>
                                ))}
                              </select>
                              <span className={`validity-badge ${validity.type}`} style={{
                                padding: '0.05rem 0.3rem',
                                borderRadius: '4px',
                                fontWeight: '700',
                                backgroundColor: validity.type === 'expired' ? 'rgba(239, 68, 68, 0.15)' : 
                                                 validity.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: validity.type === 'expired' ? 'var(--accent-danger)' :
                                       validity.type === 'warning' ? 'var(--accent-warning)' : 'var(--accent-success)'
                              }}>
                                {validity.label}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Temporary internal component wrapper for FileText icon to avoid build import errors
function FileTextIcon({ size, style }: { size?: number, style?: React.CSSProperties }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={style}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
