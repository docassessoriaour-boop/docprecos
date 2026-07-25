import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import type { Product, ShoppingItem, MarketComparison, OptimizedItem } from './types';
import { extractTextFromPDF } from './utils/pdfParser';
import { extractOffersWithGemini, extractOffersFallback, generateDemoOffers, fetchHtmlFromUrl, extractOffersFromImage, extractOffersFromPDFFile, searchOffersOnline, parseInformalShoppingList } from './utils/geminiExtractor';
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

const loadSavedProducts = () => {
  const saved = localStorage.getItem('products_list');
  if (!saved) return [];

  try {
    const savedProducts = JSON.parse(saved) as Product[];
    const containsOnlyLegacyDemo =
      savedProducts.length > 0 &&
      savedProducts.every(product => LEGACY_DEMO_PRODUCT_IDS.has(product.id));

    if (containsOnlyLegacyDemo) {
      localStorage.removeItem('products_list');
      return [];
    }

    return savedProducts;
  } catch {
    localStorage.removeItem('products_list');
    return [];
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

const getSearchTokens = (value: string) =>
  normalizeSearchText(value)
    .split(' ')
    .filter(token => token.length > 1 && !SEARCH_STOP_WORDS.has(token));

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

const getProductMatchScore = (query: string, product: Product) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(product.name);
  const normalizedCategory = normalizeSearchText(product.category);
  const normalizedMarket = normalizeSearchText(product.market);

  if (!normalizedQuery) return 1;
  if (isExcludedProductMatch(query, product.name)) return 0;
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.includes(normalizedQuery)) return 90;
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
    productTokens.has(token) ||
    normalizedName.includes(token) ||
    normalizedCategory.includes(token) ||
    normalizedMarket.includes(token)
  ).length;

  return hits / queryTokens.length;
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
  { label: 'Desinfetante', terms: ['desinfetante'] }
];

const getProductGroup = (productName: string) => {
  const normalizedName = normalizeSearchText(productName);

  if (!isExcludedProductMatch('leite', productName)) {
    return 'Leite';
  }

  const group = PRODUCT_GROUP_DEFINITIONS.find(definition =>
    definition.terms.some(term => normalizedName.includes(normalizeSearchText(term)))
  );

  if (group) return group.label;

  const [firstToken] = getSearchTokens(productName)
    .filter(token => !KNOWN_BRANDS.some(brand => normalizeSearchText(brand).split(' ').includes(token)));

  return firstToken ? firstToken.charAt(0).toUpperCase() + firstToken.slice(1) : 'Outros';
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(loadSavedProducts);
  
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  
  const [activeTab, setActiveTab] = useState<'upload' | 'catalog' | 'simulator'>('simulator');
  
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
  const [showApiKey, setShowApiKey] = useState(false);
  const importedWhatsAppIds = useRef<Set<string>>(new Set());
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedProductGroup, setSelectedProductGroup] = useState('Todos');
  const [selectedMarket, setSelectedMarket] = useState('Todos');
  const [selectedCity, setSelectedCity] = useState('Ourinhos');
  const [hideExpired, setHideExpired] = useState(true);
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('products_list', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('shopping_list', JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    localStorage.setItem('selected_offer_ids', JSON.stringify(selectedOfferIds));
  }, [selectedOfferIds]);

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
            const existingKeys = new Set(prev.map(p => `${normalizeSearchText(p.market)}|${normalizeSearchText(p.name)}|${p.price}|${p.endDate || ''}`));
            const nextProducts = [...prev];

            incomingOffers.forEach(offer => {
              if (importedWhatsAppIds.current.has(offer.id)) return;

              const key = `${normalizeSearchText(offer.market)}|${normalizeSearchText(offer.name)}|${offer.price}|${offer.endDate || ''}`;
              importedWhatsAppIds.current.add(offer.id);

              if (!existingKeys.has(key)) {
                existingKeys.add(key);
                nextProducts.push(offer);
                addedOffers += 1;
              }
            });

            return nextProducts;
          });
        }

        if (incomingItems.length > 0) {
          setShoppingList(prev => {
            const nextItems = [...prev];

            incomingItems.forEach(item => {
              if (importedWhatsAppIds.current.has(item.id)) return;
              importedWhatsAppIds.current.add(item.id);

              const idx = nextItems.findIndex(existing => normalizeSearchText(existing.name) === normalizeSearchText(item.name));
              if (idx > -1) {
                nextItems[idx] = {
                  ...nextItems[idx],
                  quantity: nextItems[idx].quantity + item.quantity
                };
              } else {
                nextItems.push(item);
              }
            });

            return nextItems;
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

    importFromWhatsAppBridge();
    const interval = window.setInterval(importFromWhatsAppBridge, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Unique lists for filtering dropdowns
  const markets = Array.from(new Set(products.map(p => p.market)));
  const cities = Array.from(new Set(products.map(p => p.city)));
  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];
  const productGroups = ['Todos', ...Array.from(new Set(products.map(p => getProductGroup(p.name)))).sort((a, b) => a.localeCompare(b, 'pt-BR'))];

  // Suggestions for autocomplete
  useEffect(() => {
    if (!customItemInput.trim()) {
      setSuggestions([]);
      return;
    }
    const matches = Array.from(new Set(
      products
        .filter(p => (selectedCity === 'Todas' || p.city === selectedCity) && getProductMatchScore(customItemInput, p) >= 0.45)
        .sort((a, b) => getProductMatchScore(customItemInput, b) - getProductMatchScore(customItemInput, a))
        .map(p => p.name)
    )).slice(0, 8);
    setSuggestions(matches);
  }, [customItemInput, products, selectedCity]);

  // Validate dates (checking if expired based on current date)
  const getValidityStatus = (endDateStr?: string) => {
    if (!endDateStr) return { label: 'Validade não informada', type: 'info' };
    
    const today = new Date(); // Current local time
    const endDate = new Date(endDateStr);
    
    // Reset hours for accurate day comparison
    today.setHours(0,0,0,0);
    endDate.setHours(0,0,0,0);

    if (endDate < today) {
      return { label: 'Oferta Expirada', type: 'expired' };
    }
    
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
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

    // Apply manual date overrides if provided
    if (extractedProducts.length > 0) {
      extractedProducts = extractedProducts.map(p => ({
        ...p,
        startDate: manualStartDate || p.startDate,
        endDate: manualEndDate || p.endDate
      }));

      setProducts(prev => [...prev, ...extractedProducts]);
      setUploadStatus(`Sucesso! ${extractedProducts.length} ofertas importadas de ${marketName} (${cityInput}).`);
      
      // Reset fields
      setMarketName('');
      setUrlInput('');
      setManualTextInput('');
      setManualStartDate('');
      setManualEndDate('');
    } else {
      setUploadStatus('Nenhum produto pôde ser extraído. Verifique o conteúdo fornecido.');
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
          extractedProducts = extractedProducts.map(p => ({
            ...p,
            startDate: manualStartDate || p.startDate,
            endDate: manualEndDate || p.endDate
          }));
          setProducts(prev => [...prev, ...extractedProducts]);
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
            extractedProducts = extractedProducts.map(p => ({
              ...p,
              startDate: manualStartDate || p.startDate,
              endDate: manualEndDate || p.endDate
            }));

            setProducts(prev => [...prev, ...extractedProducts]);
            totalImported += extractedProducts.length;
          }
        }
        setUploadStatus(`Sucesso! ${totalImported} ofertas importadas de ${files.length} imagens.`);
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
      const extractedProducts = await searchOffersOnline(apiKey, effectiveQuery, cityInput, todayStr);
      
      if (extractedProducts.length > 0) {
        setProducts(prev => {
          const existingKeys = new Set(prev.map(p => `${normalizeSearchText(p.market)}|${normalizeSearchText(p.name)}|${p.price}|${p.endDate || ''}`));
          const newProducts = extractedProducts.filter(p => {
            const key = `${normalizeSearchText(p.market)}|${normalizeSearchText(p.name)}|${p.price}|${p.endDate || ''}`;
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
          });
          return [...prev, ...newProducts];
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
            const idx = updated.findIndex(existing => existing.name.toLowerCase() === newItem.name.toLowerCase());
            if (idx > -1) {
              updated[idx].quantity += newItem.quantity;
            } else {
              updated.push({ id: String(Date.now() + Math.random()), name: newItem.name, quantity: newItem.quantity });
            }
          });
          return updated;
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
        msg += `- ${item.quantity}x _${item.name}_ ➜ *R$ ${item.price.toFixed(2)}* (no ${item.market}) - ${formatPromotionDate(item.endDate)}\n`;
      } else {
        msg += `- ${item.quantity}x _${item.name}_ ➜ *Não encontrado*\n`;
      }
    });

    msg += `\nGerado automaticamente via Radar de Preços 🚀`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const openPrintableReport = (title: string, bodyHtml: string) => {
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
          <title>${title}</title>
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
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
            th, td { border: 1px solid #d1d5db; padding: 6px 7px; font-size: 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
            td.money, th.money { text-align: right; white-space: nowrap; }
            .missing { color: #b91c1c; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Gerado em ${new Date().toLocaleDateString('pt-BR')} - Cidade: ${selectedCity}</div>
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

    const bodyHtml = allInOneComparisons
      .sort((a, b) => {
        if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
        return a.total - b.total;
      })
      .map(comparison => `
        <h2>${comparison.marketName}</h2>
        <div class="note">
          Total encontrado: R$ ${comparison.total.toFixed(2).replace('.', ',')} -
          Itens encontrados: ${comparison.availableCount} -
          Itens ausentes: ${comparison.missingCount}
        </div>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Marca</th>
              <th class="money">Qtd</th>
              <th class="money">Valor Unit.</th>
              <th class="money">Subtotal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.items
              .sort((a, b) => (a.catalogName || a.itemName).localeCompare(b.catalogName || b.itemName, 'pt-BR'))
              .map(item => `
              <tr>
                <td>${item.catalogName || item.itemName}</td>
                <td>${getLikelyBrand(item.catalogName || item.itemName)}</td>
                <td class="money">${item.quantity}</td>
                <td class="money">${item.found ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : '-'}</td>
                <td class="money">${item.found ? `R$ ${item.subtotal.toFixed(2).replace('.', ',')}` : '-'}</td>
                <td>${item.found ? 'Encontrado' : '<span class="missing">Nao encontrado</span>'}</td>
              </tr>
            `).join('')}
            <tr>
              <th colspan="4" class="money">Subtotal ${comparison.marketName}</th>
              <th class="money">R$ ${comparison.total.toFixed(2).replace('.', ',')}</th>
              <th>${comparison.missingCount > 0 ? `${comparison.missingCount} ausente(s)` : 'Completo'}</th>
            </tr>
          </tbody>
        </table>
      `).join('');

    openPrintableReport('Compra por Mercado', bodyHtml);
  };

  const exportBestPurchasePdf = () => {
    if (shoppingList.length === 0) {
      alert('Adicione itens na lista de compras antes de gerar o PDF.');
      return;
    }

    const bestSingleMarket = bestAllInOne;
    const savings = bestSingleMarket && bestSingleMarket.total > 0
      ? Math.max(0, bestSingleMarket.total - optimizedTotal)
      : 0;
    const savingsPercent = bestSingleMarket && bestSingleMarket.total > 0
      ? (savings / bestSingleMarket.total) * 100
      : 0;
    const groupedOptimizedItems = optimizedItems.reduce<Record<string, OptimizedItem[]>>((acc, item) => {
      const market = item.market || 'Não encontrado';
      acc[market] = acc[market] || [];
      acc[market].push(item);
      return acc;
    }, {});

    const groupedRowsHtml = Object.entries(groupedOptimizedItems)
      .sort(([marketA], [marketB]) => {
        if (marketA === 'Não encontrado') return 1;
        if (marketB === 'Não encontrado') return -1;
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
                <th class="money">Qtd</th>
                <th class="money">Valor Unit.</th>
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
                    <td class="money">${item.quantity}</td>
                    <td class="money">${item.market !== 'Não encontrado' ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : '-'}</td>
                    <td>${item.market !== 'Não encontrado' ? formatPromotionDate(item.endDate) : '-'}</td>
                    <td class="money">${item.market !== 'Não encontrado' ? `R$ ${item.subtotal.toFixed(2).replace('.', ',')}` : '-'}</td>
                  </tr>
                `).join('')}
              <tr>
                <th colspan="5" class="money">Subtotal ${market}</th>
                <th class="money">${market !== 'Não encontrado' ? `R$ ${marketSubtotal.toFixed(2).replace('.', ',')}` : '-'}</th>
              </tr>
            </tbody>
          </table>
        `;
      }).join('');

    const bodyHtml = `
      <div class="summary">
        <div class="box">
          <div class="label">Melhor compra dividida</div>
          <div class="value">R$ ${optimizedTotal.toFixed(2).replace('.', ',')}</div>
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
        A economia compara a compra dividida pelos menores preços encontrados com a melhor opcao de comprar tudo em um unico mercado.
      </div>
    `;

    openPrintableReport('Melhores Precos e Melhor Compra', bodyHtml);
  };

  // Add Item to Shopping List
  const addToShoppingList = (name: string) => {
    if (!name.trim()) return;
    
    const existingIndex = shoppingList.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
    if (existingIndex > -1) {
      const updated = [...shoppingList];
      updated[existingIndex].quantity += 1;
      setShoppingList(updated);
    } else {
      setShoppingList(prev => [...prev, { id: String(Date.now()), name, quantity: 1 }]);
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
      const today = new Date();
      today.setHours(0,0,0,0);
      const endDate = new Date(p.endDate);
      endDate.setHours(0,0,0,0);
      return endDate >= today;
    });

    const targetList = hideExpired ? activeProducts : (activeProducts.length > 0 ? activeProducts : marketProducts);

    const rankedMatches = targetList
      .map(product => ({ product, score: getProductMatchScore(itemName, product) }))
      .filter(({ score }) => score >= 0.45)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.product.price - b.product.price;
      });

    return rankedMatches[0]?.product;
  };

  const getItemOfferOptions = (itemName: string) => cityMarkets
    .map(market => {
      const offer = findProductOffer(itemName, market, selectedCity);
      return offer ? { offer, market } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      if (a.offer.price !== b.offer.price) return a.offer.price - b.offer.price;
      return a.market.localeCompare(b.market, 'pt-BR');
    }) as { offer: Product, market: string }[];

  // CALCULATE COMPARISONS FOR THE SELECTED CITY

  // 1. All-in-One comparisons (within selectedCity)
  const cityMarkets = Array.from(new Set(products.filter(p => selectedCity === 'Todas' || p.city === selectedCity).map(p => p.market)));
  
  const allInOneComparisons: MarketComparison[] = cityMarkets.map(market => {
    let total = 0;
    let availableCount = 0;
    let missingCount = 0;

    const items = shoppingList.map(item => {
      const offer = findProductOffer(item.name, market, selectedCity);
      const found = !!offer;
      const price = offer ? offer.price : 0;
      const subtotal = price * item.quantity;
      
      if (found) {
        total += subtotal;
        availableCount++;
      } else {
        missingCount++;
      }

      return {
        itemName: item.name,
        catalogName: offer?.name,
        price,
        found,
        quantity: item.quantity,
        subtotal
      };
    });

    return {
      marketName: market,
      total,
      availableCount,
      missingCount,
      items
    };
  });

  const sortedAllInOne = [...allInOneComparisons].sort((a, b) => {
    if (a.missingCount !== b.missingCount) {
      return a.missingCount - b.missingCount;
    }
    return a.total - b.total;
  });

  // 2. Split Optimized Comparison
  const optimizedItems: OptimizedItem[] = [];
  let optimizedTotal = 0;
  let optimizedMissingCount = 0;

  shoppingList.forEach(item => {
    const offers = getItemOfferOptions(item.name);

    if (offers.length > 0) {
      const cheapest = offers.reduce((prev, curr) => curr.offer.price < prev.offer.price ? curr : prev);
      const selectedOfferId = selectedOfferIds[item.id];
      const selectedOffer = selectedOfferId
        ? offers.find(({ offer }) => offer.id === selectedOfferId)
        : undefined;
      const chosen = selectedOffer || cheapest;
      const subtotal = chosen.offer.price * item.quantity;
      optimizedTotal += subtotal;
      optimizedItems.push({
        shoppingItemId: item.id,
        offerId: chosen.offer.id,
        name: item.name,
        catalogName: chosen.offer.name,
        quantity: item.quantity,
        price: chosen.offer.price,
        market: chosen.market,
        subtotal,
        city: selectedCity,
        endDate: chosen.offer.endDate,
        selectedManually: !!selectedOffer
      });
    } else {
      optimizedMissingCount++;
      optimizedItems.push({
        shoppingItemId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: 0,
        market: 'Não encontrado',
        subtotal: 0,
        city: selectedCity
      });
    }
  });

  const bestAllInOne = sortedAllInOne.find(m => m.missingCount === 0) || sortedAllInOne[0];
  const potentialSavings = bestAllInOne && bestAllInOne.total > 0 ? (bestAllInOne.total - optimizedTotal) : 0;

  // Filter Catalog
  const filteredProducts = products.filter(p => {
    if (hideExpired && p.endDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const endDate = new Date(p.endDate);
      endDate.setHours(0,0,0,0);
      if (endDate < today) return false;
    }
    const matchesSearch = !searchTerm.trim() || getProductMatchScore(searchTerm, p) >= 0.45;
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesProductGroup = selectedProductGroup === 'Todos' || getProductGroup(p.name) === selectedProductGroup;
    const matchesMarket = selectedMarket === 'Todos' || p.market === selectedMarket;
    const matchesCity = selectedCity === 'Todas' || p.city === selectedCity;
    return matchesSearch && matchesCategory && matchesProductGroup && matchesMarket && matchesCity;
  });

  const productsMatchingFiltersWithoutExpiry = products.filter(p => {
    const matchesSearch = !searchTerm.trim() || getProductMatchScore(searchTerm, p) >= 0.45;
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesProductGroup = selectedProductGroup === 'Todos' || getProductGroup(p.name) === selectedProductGroup;
    const matchesMarket = selectedMarket === 'Todos' || p.market === selectedMarket;
    const matchesCity = selectedCity === 'Todas' || p.city === selectedCity;
    return matchesSearch && matchesCategory && matchesProductGroup && matchesMarket && matchesCity;
  });

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

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Listagem de Produtos - Radar de Precos</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            h2 { font-size: 15px; margin: 18px 0 8px; color: #111827; }
            .meta { font-size: 11px; color: #4b5563; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
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
                Para evitar falhas do WhatsApp Web, salve PDFs/imagens na pasta ENTRADA_OFERTAS. Exemplo de nome: Mercado Avenida - ofertas.pdf.
              </div>
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
                    setProducts(prev => [...prev, ...demoOffers]);
                    setUploadStatus(`Demo: ${demoOffers.length} ofertas adicionadas para ${market} (${city}).`);
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

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input 
                type="checkbox" 
                checked={hideExpired}
                onChange={(e) => setHideExpired(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Ocultar Expirados
            </label>

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
              {hideExpired && productsMatchingFiltersWithoutExpiry.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setHideExpired(false)}
                  >
                    Mostrar ofertas expiradas ({productsMatchingFiltersWithoutExpiry.length})
                  </button>
                </div>
              )}
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

      {activeTab === 'simulator' && (
        <div className="simulator-layout">
          {/* Left panel: Build shopping list */}
          <div className="glass-panel">
            <h2 className="product-name" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Sua Lista de Compras ({selectedCity})</h2>
            <p className="text-secondary-color mb-1" style={{ fontSize: '0.85rem' }}>
              Adicione os itens que você deseja comprar. O simulador buscará automaticamente os preços nos mercados de {selectedCity}.
            </p>

            <div style={{ position: 'relative', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Digite o nome do produto (ex: Arroz)..." 
                  value={customItemInput}
                  onChange={(e) => setCustomItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addToShoppingList(customItemInput);
                  }}
                  className="input-glow"
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn-primary"
                  onClick={() => addToShoppingList(customItemInput)}
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
            </div>

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

            {shoppingList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
                <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>Sua lista está vazia.</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione produtos acima para começar.</p>
              </div>
            ) : (
              <div>
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

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
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
                    onClick={exportBestPurchasePdf}
                    style={{ justifyContent: 'center', fontWeight: '700' }}
                  >
                    <TrendingDown size={16} /> PDF Melhores Preços
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
                                  Melhor preço automático: {formatCurrency(offerOptions[0]?.offer.price || optItem.price)} - {offerOptions[0]?.market || optItem.market} - {formatPromotionDate(offerOptions[0]?.offer.endDate || optItem.endDate)}
                                </option>
                                {offerOptions.map(({ offer, market }) => (
                                  <option key={offer.id} value={offer.id}>
                                    {formatCurrency(offer.price)} - {market} - {formatPromotionDate(offer.endDate)} - {offer.name}
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
