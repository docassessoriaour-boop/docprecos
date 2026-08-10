import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Product } from '../types';

const GEMINI_MODEL_FALLBACKS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite'
];

async function generateWithGeminiFallback(apiKey: string, contents: any, tools?: any) {
  let lastError: unknown;

  for (const modelName of GEMINI_MODEL_FALLBACKS) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(tools ? { tools } : {})
      } as any);

      return await model.generateContent(contents);
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || error || '').toLowerCase();
      const canTryNextModel =
        message.includes('404') ||
        message.includes('no longer available') ||
        message.includes('not found') ||
        message.includes('model');

      if (!canTryNextModel) {
        throw error;
      }
    }
  }

  throw lastError;
}

function parseJsonArrayResponse(text: string): any[] {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFence);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const arrayMatch = withoutFence.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];
    const parsed = JSON.parse(arrayMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  }
}

function parsePrice(value: unknown): number {
  if (typeof value === 'number') return value;
  const normalized = String(value || '0')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  return Number.parseFloat(normalized) || 0;
}

function sanitizeDate(value: unknown): string | undefined {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function isActiveOffer(endDate: string | undefined, currentDate: string): boolean {
  if (!endDate) return true;
  return endDate >= currentDate;
}

export async function extractOffersWithGemini(
  text: string,
  apiKey: string,
  marketName: string,
  city: string = 'Ourinhos'
): Promise<Product[]> {
  try {
    const prompt = `
      Você é um assistente especialista em analisar panfletos e sites de supermercados.
      Analise o seguinte texto extraído de um PDF ou link de ofertas do supermercado "${marketName}" na cidade de "${city}" e extraia uma lista estruturada de TODOS os produtos e seus respectivos preços, juntamente com as datas de validade da promoção.
      
      ATENÇÃO: Extraia a lista completa de ofertas presentes. Não limite o resultado e não abrevie. Se houver 15, 30, 50 ou mais itens no folheto, extraia TODOS eles.

      REGRAS DE EXTRAÇÃO:
      1. Identifique o nome do produto de forma clara (ex: "Arroz Tipo 1 Tio João").
      2. Extraia o preço como um número decimal puro (ex: 25.99). Converta "R$ 25,99" ou "25,99" para o formato numérico 25.99.
      3. Identifique a unidade de medida se houver (ex: "5kg", "1kg", "unidade", "L").
      4. Categorize cada produto em uma das seguintes categorias padrão:
         - "Mercearia"
         - "Hortifrúti"
         - "Açougue"
         - "Bebidas"
         - "Limpeza"
         - "Higiene"
         - "Frios e Laticínios"
         - "Padaria"
         - "Outros"
      5. Encontre a data de início e a data de validade/fim da promoção no texto (ex: "ofertas válidas de 10/07/2026 a 17/07/2026"). Retorne no formato AAAA-MM-DD. Se encontrar apenas datas parciais, converta usando o ano corrente (2026).
      6. Se não houver data explícita no texto, estime com base em referências ou deixe em branco.

      Responda APENAS com um array JSON válido, sem formatações markdown extras (sem \`\`\`json ou similar), seguindo exatamente esta estrutura:
      interface ProductResult {
        name: string;
        price: number;
        category: string;
        unit: string;
        startDate?: string; // YYYY-MM-DD
        endDate?: string;   // YYYY-MM-DD
      }

      Texto extraído:
      ${text.substring(0, 30000)}
    `;

    const result = await generateWithGeminiFallback(apiKey, prompt);
    const resultText = result.response.text().trim();
    const parsed = parseJsonArrayResponse(resultText);
    
    if (Array.isArray(parsed)) {
      return parsed.map((item: any, idx: number) => ({
        id: `${marketName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`,
        name: item.name || 'Produto Sem Nome',
        price: parsePrice(item.price),
        category: item.category || 'Outros',
        unit: item.unit || 'un',
        market: marketName,
        city: city,
        startDate: sanitizeDate(item.startDate),
        endDate: sanitizeDate(item.endDate)
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Erro na extração do Gemini:', error);
    throw error;
  }
}

// Multimodal Gemini Image Offer Extractor
export async function extractOffersFromImage(
  file: File,
  apiKey: string,
  marketName: string,
  city: string = 'Ourinhos'
): Promise<Product[]> {
  try {
    // Read image file as base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type
      }
    };

    const prompt = `
      Você é um assistente especialista em analisar fotos de folhetos de ofertas de supermercados.
      Analise o imagem em anexo do supermercado "${marketName}" na cidade de "${city}" e extraia uma lista estruturada de TODOS os produtos e seus respectivos preços, juntamente com as datas de validade da promoção.
      
      ATENÇÃO: Extraia a lista completa de ofertas presentes na imagem. Não limite o resultado e não abrevie. Se houver 15, 30, 50 ou mais itens visíveis na imagem, extraia TODOS eles.

      REGRAS DE EXTRAÇÃO:
      1. Identifique o nome do produto de forma clara (ex: "Arroz Tipo 1 Tio João").
      2. Extraia o preço como um número decimal puro (ex: 25.99). Converta "R$ 25,99" ou "25,99" para o formato numérico 25.99.
      3. Identifique a unidade de medida se houver (ex: "5kg", "1kg", "unidade", "L").
      4. Categorize cada produto em uma das seguintes categorias padrão:
         - "Mercearia"
         - "Hortifrúti"
         - "Açougue"
         - "Bebidas"
         - "Limpeza"
         - "Higiene"
         - "Frios e Laticínios"
         - "Padaria"
         - "Outros"
      5. Encontre a data de início e a data de validade/fim da promoção na imagem (ex: "ofertas válidas de 10/07/2026 a 17/07/2026"). Retorne no formato AAAA-MM-DD. Se não houver data, deixe em branco.

      Responda APENAS com um array JSON válido, sem formatações markdown extras (sem \`\`\`json ou similar), seguindo exatamente esta estrutura:
      interface ProductResult {
        name: string;
        price: number;
        category: string;
        unit: string;
        startDate?: string;
        endDate?: string;
      }
    `;

    const result = await generateWithGeminiFallback(apiKey, [prompt, imagePart]);
    const resultText = result.response.text().trim();
    const parsed = parseJsonArrayResponse(resultText);
    
    if (Array.isArray(parsed)) {
      return parsed.map((item: any, idx: number) => ({
        id: `${marketName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`,
        name: item.name || 'Produto Sem Nome',
        price: parsePrice(item.price),
        category: item.category || 'Outros',
        unit: item.unit || 'un',
        market: marketName,
        city: city,
        startDate: sanitizeDate(item.startDate),
        endDate: sanitizeDate(item.endDate)
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Erro na extração de imagem do Gemini:', error);
    throw error;
  }
}

// Multimodal Gemini PDF Offer Extractor for scanned/image-based leaflets
export async function extractOffersFromPDFFile(
  file: File,
  apiKey: string,
  marketName: string,
  city: string = 'Ourinhos'
): Promise<Product[]> {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

    const pdfPart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type || 'application/pdf'
      }
    };

    const prompt = `
      Você é um assistente especialista em analisar PDFs de encartes e folhetos de supermercados.
      Analise o PDF anexado do supermercado "${marketName}" na cidade de "${city}" e extraia TODOS os produtos com preços visíveis.

      ATENÇÃO:
      - Muitos PDFs são imagens escaneadas. Leia visualmente todas as páginas.
      - Não retorne 0 ofertas se houver produtos/preços visíveis.
      - Extraia todos os itens que conseguir identificar com confiança.

      REGRAS:
      1. Nome claro do produto.
      2. Preço como número decimal puro, exemplo 25.99.
      3. Unidade, exemplo "kg", "5kg", "1L", "un".
      4. Categoria: "Mercearia", "Hortifrúti", "Açougue", "Bebidas", "Limpeza", "Higiene", "Frios e Laticínios", "Padaria" ou "Outros".
      5. Datas no formato AAAA-MM-DD quando visíveis. Se houver dia/mês sem ano, use 2026.

      Responda APENAS com um array JSON válido:
      [
        {
          "name": "Nome do Produto",
          "price": 24.90,
          "category": "Mercearia",
          "unit": "5kg",
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD"
        }
      ]
    `;

    const result = await generateWithGeminiFallback(apiKey, [prompt, pdfPart]);
    const parsed = parseJsonArrayResponse(result.response.text().trim());

    return parsed.map((item: any, idx: number) => ({
      id: `${marketName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`,
      name: item.name || 'Produto Sem Nome',
      price: parsePrice(item.price),
      category: item.category || 'Outros',
      unit: item.unit || 'un',
      market: marketName,
      city,
      startDate: sanitizeDate(item.startDate),
      endDate: sanitizeDate(item.endDate)
    })).filter(item => item.name !== 'Produto Sem Nome' && item.price > 0 && item.price < 1000);
  } catch (error) {
    console.error('Erro na extração visual de PDF do Gemini:', error);
    throw error;
  }
}

// Smart local regex fallback to extract products, dates and city
export function extractOffersFallback(
  text: string, 
  marketName: string, 
  city: string = 'Ourinhos'
): Product[] {
  const products: Product[] = [];
  const lines = text.split(/[\n\r]+/);
  
  let startDate = '2026-07-10';
  let endDate = '2026-07-20';
  
  const dateRangeRegex = /(\d{2})\/(\d{2})(?:\/(\d{4}))?\s*(?:a|até|ao|valido|validade)\s*(\d{2})\/(\d{2})(?:\/(\d{4}))?/i;
  const dateMatch = text.match(dateRangeRegex);
  if (dateMatch) {
    const startDay = dateMatch[1];
    const startMonth = dateMatch[2];
    const startYear = dateMatch[3] || '2026';
    const endDay = dateMatch[4];
    const endMonth = dateMatch[5];
    const endYear = dateMatch[6] || '2026';
    
    startDate = `${startYear}-${startMonth}-${startDay}`;
    endDate = `${endYear}-${endMonth}-${endDay}`;
  }

  const categoriesMap: { [key: string]: string } = {
    'arroz': 'Mercearia', 'feijão': 'Mercearia', 'óleo': 'Mercearia', 'açúcar': 'Mercearia', 'café': 'Mercearia',
    'leite': 'Frios e Laticínios', 'queijo': 'Frios e Laticínios', 'presunto': 'Frios e Laticínios', 'iogurte': 'Frios e Laticínios',
    'carne': 'Açougue', 'frango': 'Açougue', 'linguiça': 'Açougue', 'costela': 'Açougue', 'peixe': 'Açougue',
    'cerveja': 'Bebidas', 'refrigerante': 'Bebidas', 'suco': 'Bebidas', 'água': 'Bebidas', 'vinho': 'Bebidas',
    'detergente': 'Limpeza', 'amaciante': 'Limpeza', 'sabão': 'Limpeza', 'desinfetante': 'Limpeza',
    'sabonete': 'Higiene', 'shampoo': 'Higiene', 'creme': 'Higiene', 'dental': 'Higiene',
    'pão': 'Padaria', 'bolo': 'Padaria', 'salgado': 'Padaria',
    'banana': 'Hortifrúti', 'maçã': 'Hortifrúti', 'tomate': 'Hortifrúti', 'cebola': 'Hortifrúti', 'batata': 'Hortifrúti'
  };

  const priceRegex = /(?:R\$?\s*)?(\d+)[,.](\d{2})/i;

  lines.forEach((line, idx) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.length < 5) return;

    const match = cleanLine.match(priceRegex);
    if (match) {
      const priceStr = `${match[1]}.${match[2]}`;
      const price = parseFloat(priceStr);
      let name = cleanLine.replace(match[0], '').replace(/\s+/g, ' ').trim();
      name = name.replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, '');
      
      if (name.length > 3 && price > 0 && price < 500) {
        let category = 'Outros';
        const lowerName = name.toLowerCase();
        for (const [keyword, cat] of Object.entries(categoriesMap)) {
          if (lowerName.includes(keyword)) {
            category = cat;
            break;
          }
        }

        let unit = 'un';
        const unitMatch = name.match(/(\d+(?:\s*)(?:kg|g|l|ml|un))/i);
        if (unitMatch) {
          unit = unitMatch[1].toLowerCase().replace(/\s+/g, '');
          name = name.replace(unitMatch[0], '').trim();
        }

        products.push({
          id: `${marketName.toLowerCase().replace(/\s+/g, '-')}-${idx}-${Date.now()}`,
          name: name,
          price: price,
          category: category,
          unit: unit,
          market: marketName,
          city: city,
          startDate,
          endDate
        });
      }
    }
  });

  return products;
}

// Generate pure simulated offers for demo purposes only
export function generateDemoOffers(marketName: string, city: string = 'Ourinhos'): Product[] {
  const startDate = '2026-07-10';
  const endDate = '2026-07-24';
  
  const mockTemplates = [
    { name: 'Arroz Integral Tio João 5kg', price: 24.89, category: 'Mercearia', unit: '5kg' },
    { name: 'Feijão Carioca Camil 1kg', price: 6.49, category: 'Mercearia', unit: '1kg' },
    { name: 'Leite Integral Piracanjuba 1L', price: 4.89, category: 'Frios e Laticínios', unit: '1L' },
    { name: 'Cerveja Heineken Lata 350ml', price: 4.89, category: 'Bebidas', unit: '350ml' },
    { name: 'Alcatra Bovina kg', price: 38.90, category: 'Açougue', unit: 'kg' },
    { name: 'Detergente Ipê Limão 500ml', price: 2.39, category: 'Limpeza', unit: '500ml' },
    { name: 'Sabonete Dove Original 90g', price: 3.49, category: 'Higiene', unit: '90g' },
    { name: 'Banana Prata kg', price: 4.99, category: 'Hortifrúti', unit: 'kg' },
    { name: 'Café Melitta Vácuo 500g', price: 18.90, category: 'Mercearia', unit: '500g' },
    { name: 'Açúcar Refinado União 1kg', price: 4.59, category: 'Mercearia', unit: '1kg' },
    { name: 'Óleo de Soja Liza 900ml', price: 5.99, category: 'Mercearia', unit: '900ml' },
    { name: 'Pão de Forma Pullman 450g', price: 7.49, category: 'Padaria', unit: '450g' },
    { name: 'Queijo Muçarela Fatiado kg', price: 44.90, category: 'Frios e Laticínios', unit: 'kg' },
    { name: 'Presunto Cozido Sadia kg', price: 29.90, category: 'Frios e Laticínios', unit: 'kg' },
    { name: 'Margarina Claybom 500g', price: 6.29, category: 'Frios e Laticínios', unit: '500g' },
    { name: 'Refrigerante Coca-Cola 2L', price: 8.99, category: 'Bebidas', unit: '2L' },
    { name: 'Suco de Uva Integral Aurora 1L', price: 12.90, category: 'Bebidas', unit: '1L' },
    { name: 'Contra Filé Bovino kg', price: 42.90, category: 'Açougue', unit: 'kg' },
    { name: 'Frango Inteiro Congelado kg', price: 9.90, category: 'Açougue', unit: 'kg' },
    { name: 'Sabão em Pó Omo Lavagem Perfeita 1.6kg', price: 19.90, category: 'Limpeza', unit: '1.6kg' },
    { name: 'Amaciante Downy Concentrado 500ml', price: 14.89, category: 'Limpeza', unit: '500ml' },
    { name: 'Shampoo Pantene 400ml', price: 16.90, category: 'Higiene', unit: '400ml' },
    { name: 'Creme Dental Colgate Total 12 90g', price: 5.89, category: 'Higiene', unit: '90g' },
    { name: 'Tomate Italiano kg', price: 6.99, category: 'Hortifrúti', unit: 'kg' },
    { name: 'Cebola kg', price: 4.89, category: 'Hortifrúti', unit: 'kg' },
    { name: 'Batata Monalisa kg', price: 5.49, category: 'Hortifrúti', unit: 'kg' }
  ];

  return mockTemplates.map((item, idx) => ({
    id: `${marketName.toLowerCase().replace(/\s+/g, '-')}-mock-${idx}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    name: `${item.name} (${marketName})`,
    price: +(item.price * (0.85 + Math.random() * 0.3)).toFixed(2),
    category: item.category,
    unit: item.unit,
    market: marketName,
    city: city,
    startDate,
    endDate
  }));
}

// Scrape link content (handles standard text copy-paste or web fetch using open CORS proxy)
export async function fetchHtmlFromUrl(url: string): Promise<string> {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Falha ao acessar o link via proxy');
    const data = await response.json();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, 'text/html');
    
    const scripts = doc.querySelectorAll('script, style, header, footer, nav');
    scripts.forEach(s => s.remove());
    
    return doc.body.innerText || doc.body.textContent || '';
  } catch (error) {
    console.error('Erro de CORS/Fetch. Exigindo colagem manual ou fallback:', error);
    throw new Error('Não foi possível ler o link diretamente devido a restrições de CORS. Cole o texto da página no campo correspondente.');
  }
}

// Search web for supermarket offers in Ourinhos using Gemini Search Grounding
export async function searchOffersOnline(
  apiKey: string,
  query: string,
  city: string = 'Ourinhos',
  currentDate: string = new Date().toISOString().split('T')[0]
): Promise<Product[]> {
  try {
    const cleanedQuery = query.trim();
    const searchQuery = cleanedQuery
      ? `preço oferta supermercado ${cleanedQuery} ${city} SP encarte válido`
      : `encarte ofertas supermercado ${city} SP válido hoje`;
    const wantedItems = cleanedQuery
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const prompt = `
      Você é um assistente especialista em pesquisar e analisar ofertas de supermercados na internet.
      Hoje é dia ${currentDate}.
      
      Sua tarefa é fazer uma pesquisa na internet sobre: "${searchQuery}".
      Itens prioritários: ${wantedItems.length > 0 ? wantedItems.join(', ') : 'ofertas gerais de cesta básica, carnes, frios, bebidas, limpeza e hortifrúti'}.
      Identifique ofertas atuais válidas (cuja data de validade seja IGUAL OU MAIOR que ${currentDate}) nos supermercados, mercados e atacados da cidade de ${city} e região próxima.
      Priorize fontes oficiais, encartes digitais, páginas de ofertas dos mercados e plataformas de folhetos. Não invente ofertas sem fonte pública.

      REGRAS DE EXTRAÇÃO:
      1. Extraia o nome do produto (ex: "Cerveja Heineken Lata 350ml", "Arroz Tipo 1 Tio João 5kg").
      2. Extraia o preço como número decimal puro (ex: 4.99 ou 24.90).
      3. Identifique o supermercado/estabelecimento onde a oferta está ativa (campo "market").
      4. Identifique a unidade de medida (ex: "5kg", "1kg", "unidade", "L", "350ml").
      5. Categorize cada produto em uma das seguintes categorias padrão:
         - "Mercearia"
         - "Hortifrúti"
         - "Açougue"
         - "Bebidas"
         - "Limpeza"
         - "Higiene"
         - "Frios e Laticínios"
         - "Padaria"
         - "Outros"
      6. Extraia a data de início e a data de validade/fim da promoção (campo "endDate"). A validade DEVE ser igual ou maior que ${currentDate} para ser considerada ativa. Se o site ou panfleto não especificar o ano, use 2026. Se não houver validade explícita, deixe endDate em branco.
      7. A cidade deve ser "${city}".
      8. Quando o usuário informar itens prioritários, retorne primeiro ofertas que correspondam a esses itens. Aceite variações próximas, como "leite" para "leite integral 1L".
      9. Descarte preços improváveis ou textos que não sejam produtos de supermercado.
      10. Para itens de limpeza, respeite o produto principal. Se o item pedido for "sabão em barra", "sabão em pedra" ou "sabão em pedaço", retorne apenas sabão de lavar roupa em barra/pedra/pedaço; nunca retorne chocolate, alimentos ou sabonete só porque também usam a palavra "barra".

      Retorne APENAS um array JSON válido (sem formatações markdown extras, sem \`\`\`json ou similar), contendo objetos na seguinte estrutura:
      [
        {
          "name": "Nome do Produto",
          "price": 24.90,
          "category": "Mercearia",
          "unit": "5kg",
          "market": "Nome do Supermercado",
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD"
        }
      ]
      
      Importante: Se não encontrar ofertas reais online para a busca, tente encontrar o folheto online mais recente de qualquer supermercado em ${city} ou cidade vizinha e extraia itens reais. Se mesmo assim nada for encontrado, retorne uma lista vazia [].
    `;

    const result = await generateWithGeminiFallback(apiKey, prompt, [{ googleSearch: {} }] as any);
    const resultText = result.response.text().trim();
    const parsed = parseJsonArrayResponse(resultText);
    
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any, idx: number) => {
          const price = parsePrice(item.price);
          const endDate = sanitizeDate(item.endDate);
          return {
            id: `${(item.market || 'online').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`,
            name: String(item.name || '').trim() || 'Produto Sem Nome',
            price,
            category: item.category || 'Outros',
            unit: item.unit || 'un',
            market: String(item.market || '').trim() || 'Supermercado Online',
            city: city,
            startDate: sanitizeDate(item.startDate),
            endDate
          };
        })
        .filter(item => item.name !== 'Produto Sem Nome' && item.price > 0 && item.price < 1000 && isActiveOffer(item.endDate, currentDate));
    }
    
    return [];
  } catch (error) {
    console.error('Erro na pesquisa online com Gemini:', error);
    throw error;
  }
}

// Parse informal shopping lists (e.g. from WhatsApp messages) using Gemini
export async function parseInformalShoppingList(
  text: string,
  apiKey: string
): Promise<{ name: string; quantity: number }[]> {
  try {
    const prompt = `
      Você é um assistente especialista em analisar mensagens de texto informais e listas de compras.
      Sua tarefa é analisar o seguinte texto, extrair todos os itens de compra listados e suas respectivas quantidades.
      
      Regras:
      1. Normalize o nome do item (ex: "arroz", "leite integral", "cerveja heineken").
      2. Tente extrair a quantidade numérica correta (ex: "3 leites" -> quantidade 3, "um detergente" -> quantidade 1). Se não houver quantidade especificada, use 1.
      3. Se o texto contiver termos informais que não sejam produtos de supermercado, ignore-os.

      Responda APENAS com um array JSON válido (sem formatações markdown extras, sem \`\`\`json ou similar), seguindo exatamente esta estrutura:
      [
        {
          "name": "Nome do Produto",
          "quantity": 2
        }
      ]

      Texto informal:
      "${text}"
    `;

    const result = await generateWithGeminiFallback(apiKey, prompt);
    const resultText = result.response.text().trim();
    const parsed = parseJsonArrayResponse(resultText);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        name: String(item.name || 'Item'),
        quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity || '1'), 10) || 1
      }));
    }
    return [];
  } catch (error) {
    console.error('Erro ao analisar lista informal do WhatsApp:', error);
    throw error;
  }
}
