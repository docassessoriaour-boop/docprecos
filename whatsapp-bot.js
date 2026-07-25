/**
 * Radar de Preços - WhatsApp Bot (Local Integration)
 * 
 * Este script roda um servidor local e um cliente de WhatsApp.
 * Ele permite receber mensagens, imagens ou PDFs e extrair ofertas usando o Gemini.
 * 
 * Para rodar este bot:
 * 1. Instale as dependências adicionais no terminal:
 *    npm install whatsapp-web.js qrcode-terminal express cors dotenv @google/generative-ai
 * 
 * 2. Crie um arquivo .env na raiz com sua chave API:
 *    GEMINI_API_KEY=sua_chave_aqui
 * 
 * 3. Inicie o bot:
 *    node whatsapp-bot.js
 * 
 * 4. Escaneie o QR Code que aparecerá no terminal com o WhatsApp do seu celular.
 */

import express from 'express';
import cors from 'cors';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const apiKey = process.env.GEMINI_API_KEY || '';
const shouldResetSession = process.argv.includes('--reset-session');
const whatsappWebVersion = process.env.WWEB_VERSION || '';
const authClientId = shouldResetSession ? `radar-precos-${Date.now()}` : 'radar-precos';
const offersInboxFolder = path.resolve(process.env.OFFERS_INBOX || 'ENTRADA_OFERTAS');
const processedFilesPath = path.resolve('.processed-offer-files.json');
const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
];

// In-memory data store for WhatsApp imports
let importedOffers = [];
let pendingShoppingItems = [];
let processedFileKeys = new Set();
let isScanningOfferFolder = false;
let quotaPausedUntil = 0;

function backupFolderIfExists(folderName) {
  const folderPath = path.resolve(folderName);
  if (!fs.existsSync(folderPath)) return;

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
  const backupPath = path.resolve(`${folderName}.backup-${timestamp}`);

  try {
    fs.renameSync(folderPath, backupPath);
    console.log(`Sessao antiga movida para: ${backupPath}`);
  } catch (error) {
    console.log(`Nao foi possivel mover ${folderName}. Vou iniciar uma sessao nova separada.`);
    console.log(`Motivo: ${error?.code || error?.message || error}`);
  }
}

if (shouldResetSession) {
  console.log('Reiniciando sessao do WhatsApp. Um novo QR Code sera gerado.');
  backupFolderIfExists('.wwebjs_auth');
  backupFolderIfExists('.wwebjs_cache');
}

async function generateWithGeminiFallback(contents) {
  let lastError;

  for (const modelName of GEMINI_MODEL_FALLBACKS) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      return await model.generateContent(contents);
    } catch (error) {
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

function getFriendlyError(error) {
  if (isQuotaError(error)) {
    return 'Cota da Gemini API atingida ou chave sem cota gratuita disponível.';
  }

  return error?.message || String(error);
}

function parseJsonArrayResponse(text) {
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

function parsePrice(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value || '0')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  return Number.parseFloat(normalized) || 0;
}

function sanitizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function isQuotaError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('quota') ||
    message.includes('rate limit')
  );
}

function pauseForQuota(error) {
  const message = String(error?.message || error || '');
  const retryMatch = message.match(/retry in ([\d.]+)s/i);
  const retrySeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : 300;
  quotaPausedUntil = Date.now() + Math.max(retrySeconds, 60) * 1000;
  console.log(`⏳ Cota da IA atingida. Vou pausar novas leituras até ${new Date(quotaPausedUntil).toLocaleTimeString('pt-BR')}.`);
  console.log('Para continuar agora, use uma chave com billing/cota ativa ou aguarde a liberação da cota gratuita.');
}

function normalizeOffer(rawItem, idx, fallbackMarket, sourceLabel) {
  const market = String(rawItem.market || fallbackMarket || 'WhatsApp').trim();

  return {
    id: `wa-offer-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`,
    name: String(rawItem.name || 'Produto sem nome').trim(),
    price: parsePrice(rawItem.price),
    category: rawItem.category || 'Outros',
    unit: rawItem.unit || 'un',
    market,
    city: rawItem.city || 'Ourinhos',
    startDate: sanitizeDate(rawItem.startDate),
    endDate: sanitizeDate(rawItem.endDate) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: sourceLabel
  };
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadMediaViaStream(msg) {
  if (typeof msg.downloadMediaStream !== 'function') {
    return undefined;
  }

  const mediaStream = await msg.downloadMediaStream();
  if (!mediaStream?.stream || !mediaStream?.mimetype) {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of mediaStream.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    return undefined;
  }

  return {
    data: buffer.toString('base64'),
    mimetype: mediaStream.mimetype,
    filename: mediaStream.filename,
    filesize: mediaStream.filesize || buffer.length
  };
}

async function downloadMediaDirectlyFromWhatsApp(msg) {
  const result = await client.pupPage.evaluate(async (msgId) => {
    const msg =
      window.require('WAWebCollections').Msg.get(msgId) ||
      (
        await window
          .require('WAWebCollections')
          .Msg.getMessagesById([msgId])
      )?.messages?.[0];

    if (!msg || !msg.mediaData) {
      return null;
    }

    if (msg.mediaData.mediaStage !== 'RESOLVED') {
      try {
        await msg.downloadMedia({
          downloadEvenIfExpensive: true,
          rmrReason: 1
        });
      } catch {
        // Some WhatsApp Web builds throw a short minified error here,
        // but the direct media fields can still be usable below.
      }
    }

    if (!msg.directPath || !msg.mediaKey) {
      return null;
    }

    const mockQpl = {
      addAnnotations() {
        return this;
      },
      addPoint() {
        return this;
      }
    };

    const decryptedMedia = await window
      .require('WAWebDownloadManager')
      .downloadManager.downloadAndMaybeDecrypt({
        directPath: msg.directPath,
        encFilehash: msg.encFilehash,
        filehash: msg.filehash,
        mediaKey: msg.mediaKey,
        mediaKeyTimestamp: msg.mediaKeyTimestamp,
        type: msg.type,
        signal: new AbortController().signal,
        downloadQpl: mockQpl
      });

    const data = await window.WWebJS.arrayBufferToBase64Async(decryptedMedia);

    return {
      data,
      mimetype: msg.mimetype,
      filename: msg.filename,
      filesize: msg.size
    };
  }, msg.id._serialized);

  return result?.data && result?.mimetype ? result : undefined;
}

async function downloadMediaWithRetry(msg, attempts = 4) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const streamedMedia = await downloadMediaViaStream(msg);
      if (streamedMedia?.data && streamedMedia?.mimetype) {
        return streamedMedia;
      }

      const media = await msg.downloadMedia();
      if (media?.data && media?.mimetype) {
        return media;
      }
      lastError = new Error('WhatsApp nao retornou o arquivo da midia.');
    } catch (error) {
      lastError = error;

      try {
        const media = await downloadMediaDirectlyFromWhatsApp(msg);
        if (media?.data && media?.mimetype) {
          return media;
        }
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }

    if (attempt < attempts) {
      await wait(1500 * attempt);
    }
  }

  throw lastError;
}

async function extractOffersFromMedia(media, fallbackMarket, sourceLabel) {
  const mediaPart = {
    inlineData: {
      data: media.data,
      mimeType: media.mimetype
    }
  };

  const prompt = `
    Você é um assistente especialista em analisar ofertas de supermercados de Ourinhos/SP recebidas por WhatsApp.
    Analise o arquivo anexado, que pode ser uma imagem ou PDF de encarte, e extraia TODAS as ofertas visíveis.

    Se o nome do supermercado estiver visível, retorne esse nome no campo "market". Se não estiver visível, use "${fallbackMarket}".
    Se houver data de validade, retorne em AAAA-MM-DD. Se houver apenas dia e mês, use o ano atual 2026.
    Se houver mais de um preço para o mesmo item, use o preço principal destacado na oferta.
    Se a marca estiver no nome, mantenha no campo "name". Se não souber a unidade, use "un".
    Nao retorne lista vazia quando houver qualquer produto com preço visível.

    Responda APENAS com um array JSON válido:
    [
      {
        "name": "Nome do Produto",
        "price": 4.99,
        "category": "Mercearia | Hortifrúti | Açougue | Bebidas | Limpeza | Higiene | Frios e Laticínios | Padaria | Outros",
        "unit": "un",
        "market": "Nome do Supermercado",
        "city": "Ourinhos",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD"
      }
    ]
  `;

  const result = await generateWithGeminiFallback([prompt, mediaPart]);
  const parsed = parseJsonArrayResponse(result.response.text());

  return parsed
    .map((item, idx) => normalizeOffer(item, idx, fallbackMarket, sourceLabel))
    .filter(item => item.name !== 'Produto sem nome' && item.price > 0 && item.price < 1000);
}

function getMediaMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };

  return mimeTypes[ext];
}

function inferMarketNameFromFile(filePath) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext).replace(/[_]+/g, ' ').trim();
  const [marketCandidate] = baseName.split(/\s+-\s+/);
  return marketCandidate && marketCandidate.length > 2 ? marketCandidate : 'Pasta Monitorada';
}

function loadProcessedFileKeys() {
  try {
    if (!fs.existsSync(processedFilesPath)) return;
    const parsed = JSON.parse(fs.readFileSync(processedFilesPath, 'utf8'));
    if (Array.isArray(parsed)) {
      processedFileKeys = new Set(parsed);
    }
  } catch (error) {
    console.log('Nao foi possivel ler o controle de arquivos processados:', error?.message || error);
  }
}

function saveProcessedFileKeys() {
  try {
    fs.writeFileSync(processedFilesPath, JSON.stringify([...processedFileKeys], null, 2));
  } catch (error) {
    console.log('Nao foi possivel salvar o controle de arquivos processados:', error?.message || error);
  }
}

async function processOfferFile(filePath) {
  const mimeType = getMediaMimeType(filePath);
  if (!mimeType) return;

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return;

  // Avoid reading a file that is still being copied into the folder.
  if (Date.now() - stat.mtimeMs < 3000) return;

  const fileKey = `${path.basename(filePath)}|${stat.size}|${Math.round(stat.mtimeMs)}`;
  if (processedFileKeys.has(fileKey)) return;

  console.log(`📁 Arquivo encontrado na pasta monitorada: ${path.basename(filePath)}`);

  const media = {
    data: fs.readFileSync(filePath).toString('base64'),
    mimetype: mimeType,
    filename: path.basename(filePath),
    filesize: stat.size
  };

  const marketName = inferMarketNameFromFile(filePath);
  const extractedOffers = await extractOffersFromMedia(media, marketName, 'Pasta monitorada');

  if (extractedOffers.length > 0) {
    importedOffers.push(...extractedOffers);
    processedFileKeys.add(fileKey);
    saveProcessedFileKeys();
  }

  console.log(`✅ Pasta monitorada: ${extractedOffers.length} ofertas extraídas de ${path.basename(filePath)}.`);
  if (extractedOffers.length === 0) {
    console.log('O arquivo NAO foi marcado como concluido. Ele sera tentado novamente quando a cota/modelo permitir.');
    console.log('Se o mercado ficou errado ou deu 0 ofertas, renomeie o arquivo como "Nome do Mercado - folheto.pdf" e tente novamente.');
  }
}

async function scanOffersInboxFolder() {
  if (isScanningOfferFolder) return;
  if (quotaPausedUntil && Date.now() < quotaPausedUntil) return;
  isScanningOfferFolder = true;

  try {
    const files = fs.readdirSync(offersInboxFolder)
      .map(fileName => path.join(offersInboxFolder, fileName))
      .filter(filePath => getMediaMimeType(filePath));

    for (const filePath of files) {
      try {
        await processOfferFile(filePath);
      } catch (error) {
        if (isQuotaError(error)) {
          pauseForQuota(error);
          break;
        }
        console.log(`❌ Erro ao processar ${path.basename(filePath)}:`, getFriendlyError(error));
      }
    }
  } finally {
    isScanningOfferFolder = false;
  }
}

function startOffersInboxWatcher() {
  fs.mkdirSync(offersInboxFolder, { recursive: true });
  loadProcessedFileKeys();

  console.log(`📂 Pasta monitorada para ofertas: ${offersInboxFolder}`);
  console.log('Coloque PDFs ou imagens nessa pasta. Dica: use "Nome do Mercado - folheto.pdf".');

  setTimeout(scanOffersInboxFolder, 2000);
  setInterval(scanOffersInboxFolder, 6000);
}

// Endpoint to fetch imported items from the React frontend
app.get('/api/whatsapp-imports', (req, res) => {
  res.json({
    offers: importedOffers,
    shoppingItems: pendingShoppingItems
  });
});

// Endpoint to clear imports
app.post('/api/whatsapp-clear', (req, res) => {
  importedOffers = [];
  pendingShoppingItems = [];
  res.json({ success: true });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor do Bot rodando em http://localhost:${PORT}`);
  startOffersInboxWatcher();
});

if (!apiKey) {
  console.log('⚠️ AVISO: GEMINI_API_KEY não definida no arquivo .env.');
}

console.log('🔄 Inicializando cliente do WhatsApp...');
if (whatsappWebVersion) {
  console.log(`Usando WhatsApp Web ${whatsappWebVersion}.`);
}

const clientOptions = {
  authStrategy: new LocalAuth({ clientId: authClientId }),
  puppeteer: {
    handleSIGINT: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};

if (whatsappWebVersion) {
  clientOptions.webVersion = whatsappWebVersion;
  clientOptions.webVersionCache = {
    type: 'remote',
    remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${whatsappWebVersion}.html`,
    strict: true
  };
}

const client = new Client(clientOptions);

client.on('qr', (qr) => {
  console.log('\n📱 ESCANEIE O QR CODE ABAIXO COM O WHATSAPP DO CELULAR:');
  qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
  console.log(`Carregando WhatsApp Web: ${percent}% ${message || ''}`.trim());
});

client.on('authenticated', () => {
  console.log('WhatsApp autenticado. Finalizando carregamento...');
});

client.on('auth_failure', (message) => {
  console.error('Falha na autenticacao do WhatsApp:', message);
  console.error('Rode npm run bot:reset e escaneie um novo QR Code.');
});

client.on('disconnected', (reason) => {
  console.log('WhatsApp desconectado:', reason);
});

client.on('ready', () => {
  console.log('\n🟢 Bot de WhatsApp conectado e pronto para receber mensagens!');
  console.log('Envie mensagens de texto com listas, fotos de panfletos ou PDFs para o seu próprio número ou grupo com o bot.');
});

// Message listener
client.on('message', async (msg) => {
  const text = msg.body ? msg.body.trim() : '';
  
  // 1. Text message list imports (e.g. "/lista arroz, feijao, leite")
  if (text.toLowerCase().startsWith('/lista ')) {
    const listContent = text.substring(7);
    console.log(`📩 Recebida lista via WhatsApp: "${listContent}"`);
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      
      const prompt = `Extraia itens de compra e quantidades desta mensagem informal em formato JSON: [ { "name": "Nome", "quantity": 1 } ]. Mensagem: "${listContent}"`;
      const result = await model.generateContent(prompt);
      const cleanJSON = result.response.text().trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanJSON);
      
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          pendingShoppingItems.push({
            id: `wa-${Date.now()}-${Math.random()}`,
            name: item.name,
            quantity: item.quantity || 1
          });
        });
        msg.reply(`✅ Adicionado ${parsed.length} itens à lista do Radar de Preços!`);
      }
    } catch (err) {
      console.error('Erro ao processar lista do WhatsApp:', err);
      msg.reply('❌ Erro ao analisar lista. Verifique a chave de API.');
    }
  }

  // 2. Multimodal offer extraction from image
  if (msg.hasMedia) {
    console.log('📩 Recebida imagem ou arquivo de mídia via WhatsApp...');
    try {
      const media = await downloadMediaWithRetry(msg);
      console.log(`Mídia baixada: ${media.mimetype}${media.filename ? ` (${media.filename})` : ''}${media.filesize ? ` - ${media.filesize} bytes` : ''}`);
      const isImage = media.mimetype.startsWith('image/');
      const isPdf = media.mimetype === 'application/pdf';

      if (isImage || isPdf) {
        const chat = await msg.getChat();
        const fallbackMarket = chat?.name || msg._data?.notifyName || 'WhatsApp';
        const sourceLabel = isPdf ? 'PDF recebido pelo WhatsApp' : 'Imagem recebida pelo WhatsApp';
        msg.reply(`⏳ ${isPdf ? 'PDF' : 'Imagem'} recebido. Analisando ofertas automaticamente...`);

        const extractedOffers = await extractOffersFromMedia(media, fallbackMarket, sourceLabel);
        importedOffers.push(...extractedOffers);

        msg.reply(`✅ Sucesso! Extraídas ${extractedOffers.length} ofertas para o Radar de Preços.`);
      } else {
        msg.reply('Recebi a mídia, mas por enquanto processo automaticamente apenas imagens e PDFs de ofertas.');
      }
    } catch (err) {
      console.error('Erro ao processar mídia do WhatsApp:', err);
      const errorMessage = String(err?.message || err || '');
      const isDownloadError =
        errorMessage.length <= 3 ||
        errorMessage.toLowerCase().includes('download') ||
        errorMessage.toLowerCase().includes('midia') ||
        errorMessage.toLowerCase().includes('media');

      if (isDownloadError) {
        msg.reply('❌ O WhatsApp Web não liberou o arquivo para leitura. Tente encaminhar novamente o PDF/imagem ou envie como documento.');
      } else {
        msg.reply('❌ Erro ao analisar a mídia com IA. Verifique a chave e tente novamente.');
      }
    }
  }
});

client.initialize();
