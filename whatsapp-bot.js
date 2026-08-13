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
const enableDirectMediaDownload = process.env.WWEB_DIRECT_MEDIA === 'true';
const authClientId = shouldResetSession ? `radar-precos-${Date.now()}` : 'radar-precos';
const offersInboxFolder = path.resolve(process.env.OFFERS_INBOX || 'ENTRADA_OFERTAS');
const processedFilesPath = path.resolve('.processed-offer-files.json');
const receivedWhatsAppFolder = path.join(offersInboxFolder, 'WhatsApp');
const ownerWhatsAppNumber = '14988359798';
const monitoredMarkets = [
  { market: 'AMIGAO', phones: ['14996230389', '14920059637'] },
  { market: 'SAGRADA FAMILIA', phones: ['14998290971', '14996633969', '14996311107'] },
  { market: 'MAX', phones: ['14991297822', '41920001902'] },
  { market: 'SAO JUDAS', phones: ['11956397896', '14996695703'] },
  { market: 'ATACADAO', phones: ['14997445160'] },
  { market: 'BOM JESUS', phones: ['14997782966'] }
];
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
let processedMessageIds = new Set();
let forceScannedMessageIds = new Set();
let isScanningOfferFolder = false;
let historyScan = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  checkedMessages: 0,
  processedMedia: 0,
  error: null
};
let quotaPausedUntil = 0;
let client;
let isRestartingWhatsAppClient = false;
let initializeRetryCount = 0;
let isWhatsAppReady = false;

function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

const ownerWhatsAppNumberNormalized = normalizePhoneNumber(ownerWhatsAppNumber);
const monitoredPhoneToMarket = new Map(
  monitoredMarkets.flatMap(({ market, phones }) =>
    phones.map(phone => [normalizePhoneNumber(phone), market])
  )
);

function getBareWhatsAppNumber(value) {
  return String(value || '')
    .split('@')[0]
    .replace(/\D/g, '');
}

function getMessageSource(msg) {
  const senderNumber = getBareWhatsAppNumber(msg.author || msg.from);
  const chatNumber = getBareWhatsAppNumber(msg.from);
  const targetNumber = getBareWhatsAppNumber(msg.to);
  const market =
    monitoredPhoneToMarket.get(senderNumber) ||
    monitoredPhoneToMarket.get(chatNumber);

  return {
    senderNumber,
    chatNumber,
    targetNumber,
    market,
    isOwnerMessage:
      senderNumber === ownerWhatsAppNumberNormalized ||
      chatNumber === ownerWhatsAppNumberNormalized ||
      targetNumber === ownerWhatsAppNumberNormalized,
    isMonitoredMarket: Boolean(market)
  };
}

function normalizeMarketText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function getMarketFromChat(chat) {
  const chatNumber = normalizePhoneNumber(getBareWhatsAppNumber(chat?.id?._serialized));
  const directMarket = monitoredPhoneToMarket.get(chatNumber);
  if (directMarket) return directMarket;

  const normalizedChatName = normalizeMarketText(chat?.name);
  return monitoredMarkets.find(({ market }) =>
    normalizedChatName.includes(normalizeMarketText(market))
  )?.market || null;
}

function getMediaExtension(media) {
  const filenameExt = path.extname(media.filename || '').toLowerCase();
  if (filenameExt) return filenameExt;

  const mimeExtensions = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
  };

  return mimeExtensions[media.mimetype] || '';
}

function sanitizeFileNamePart(value) {
  return String(value || 'WhatsApp')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'WhatsApp';
}

function saveIncomingMediaFile(media, marketName) {
  fs.mkdirSync(receivedWhatsAppFolder, { recursive: true });
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
  const ext = getMediaExtension(media);
  const fileName = `${sanitizeFileNamePart(marketName)} - WhatsApp - ${timestamp}${ext}`;
  const filePath = path.join(receivedWhatsAppFolder, fileName);

  fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
  return filePath;
}

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

function getCompactError(error) {
  const message = String(error?.message || error || '').trim();
  return message || error?.name || 'erro sem detalhe';
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

async function safeReply(msg, text) {
  try {
    await msg.reply(text);
  } catch (error) {
    console.log(`Nao foi possivel responder pelo WhatsApp: ${error?.message || error}`);
  }
}

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
  if (!client?.pupPage) {
    return undefined;
  }

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

    const downloadManager = window.require('WAWebDownloadManager')?.downloadManager;
    if (typeof downloadManager?.downloadAndMaybeDecrypt !== 'function') {
      return null;
    }

    const decryptedMedia = await downloadManager.downloadAndMaybeDecrypt({
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
    } catch (error) {
      lastError = error;
      console.log(`Tentativa ${attempt}/${attempts}: stream de mídia indisponível (${getCompactError(error)}).`);
    }

    try {
      const media = await msg.downloadMedia();
      if (media?.data && media?.mimetype) {
        return media;
      }
      lastError = new Error('WhatsApp nao retornou o arquivo da midia.');
    } catch (error) {
      lastError = error;
      console.log(`Tentativa ${attempt}/${attempts}: WhatsApp nao liberou a mídia (${getCompactError(error)}).`);
    }

    if (enableDirectMediaDownload) {
      try {
        const media = await downloadMediaDirectlyFromWhatsApp(msg);
        if (media?.data && media?.mimetype) {
          return media;
        }
      } catch (fallbackError) {
        lastError = fallbackError;
        console.log(`Tentativa ${attempt}/${attempts}: download interno falhou (${getCompactError(fallbackError)}).`);
      }
    } else if (attempt === 1) {
      console.log('Download interno do WhatsApp Web desativado para evitar falhas desta versão. Para reativar, use WWEB_DIRECT_MEDIA=true.');
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

app.get('/api/whatsapp-config', (req, res) => {
  res.json({
    ownerWhatsAppNumber,
    monitoredMarkets,
    offersInboxFolder,
    receivedWhatsAppFolder,
    isWhatsAppReady
  });
});

app.get('/api/whatsapp-scan-history', (req, res) => {
  res.json(historyScan);
});

app.post('/api/whatsapp-scan-history', (req, res) => {
  if (!isWhatsAppReady || !client) {
    return res.status(503).json({ error: 'WhatsApp ainda nao esta conectado.' });
  }
  if (historyScan.status === 'running') {
    return res.status(409).json(historyScan);
  }

  historyScan = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    checkedMessages: 0,
    processedMedia: 0,
    error: null
  };
  res.status(202).json(historyScan);

  scanWhatsAppHistory().catch(error => {
    historyScan = {
      ...historyScan,
      status: 'error',
      finishedAt: new Date().toISOString(),
      error: getCompactError(error)
    };
    console.error('Erro na verificacao manual do WhatsApp:', error);
  });
});

async function scanWhatsAppHistory() {
  const historyLimit = Math.max(1, Math.min(Number(process.env.WWEB_HISTORY_LIMIT) || 80, 250));
  const historyDays = Math.max(1, Math.min(Number(process.env.WWEB_HISTORY_DAYS) || 14, 60));
  const oldestTimestamp = Math.floor((Date.now() - historyDays * 86400000) / 1000);
  const chats = await client.getChats();

  for (const chat of chats) {
    const chatMarket = getMarketFromChat(chat);
    const messages = await chat.fetchMessages({ limit: historyLimit });
    for (const msg of messages) {
      if (!msg.hasMedia || Number(msg.timestamp || 0) < oldestTimestamp) continue;
      const messageMarket = getMessageSource(msg).market || chatMarket;
      if (!messageMarket) continue;
      historyScan.checkedMessages += 1;
      const messageId = msg.id?._serialized || `${msg.from}-${msg.timestamp}-${msg.body || ''}`;
      if (forceScannedMessageIds.has(messageId)) continue;
      forceScannedMessageIds.add(messageId);
      await handleWhatsAppMessage(msg, {
        includeOwnMessages: true,
        suppressReplies: true,
        forcedMarket: messageMarket,
        forceReprocess: true
      });
      historyScan.processedMedia += 1;
    }
  }

  historyScan = {
    ...historyScan,
    status: 'completed',
    finishedAt: new Date().toISOString()
  };
}

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

function buildClientOptions() {
  const options = {
    authStrategy: new LocalAuth({ clientId: authClientId }),
    puppeteer: {
      handleSIGINT: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  };

  if (whatsappWebVersion) {
    options.webVersion = whatsappWebVersion;
    options.webVersionCache = {
      type: 'remote',
      remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${whatsappWebVersion}.html`,
      strict: true
    };
  }

  return options;
}

function isTransientWhatsAppError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('execution context was destroyed') ||
    message.includes('navigation') ||
    message.includes('target closed') ||
    message.includes('session closed') ||
    message.includes('protocol error') ||
    message.includes('context') ||
    message.includes('wweb')
  );
}

function scheduleWhatsAppRestart(reason, delayMs = 8000) {
  if (isRestartingWhatsAppClient) return;
  isRestartingWhatsAppClient = true;

  const reasonText = reason?.message || reason || 'instabilidade do WhatsApp Web';
  console.log(`🔁 WhatsApp Web recarregou ou falhou: ${reasonText}`);
  console.log(`Vou tentar iniciar o coletor novamente em ${Math.round(delayMs / 1000)} segundos.`);

  setTimeout(async () => {
    const previousClient = client;
    client = undefined;

    try {
      await previousClient?.destroy();
    } catch {
      // The page may already be gone after a WhatsApp Web navigation.
    }

    isRestartingWhatsAppClient = false;
    initializeRetryCount += 1;
    initializeWhatsAppClient();
  }, delayMs);
}

function attachWhatsAppHandlers(nextClient) {
  nextClient.on('qr', (qr) => {
    console.log('\n📱 ESCANEIE O QR CODE ABAIXO COM O WHATSAPP DO CELULAR:');
    qrcode.generate(qr, { small: true });
  });

  nextClient.on('loading_screen', (percent, message) => {
    console.log(`Carregando WhatsApp Web: ${percent}% ${message || ''}`.trim());
  });

  nextClient.on('authenticated', () => {
    console.log('WhatsApp autenticado. Finalizando carregamento...');
  });

  nextClient.on('auth_failure', (message) => {
    console.error('Falha na autenticacao do WhatsApp:', message);
    console.error('Rode npm run bot:reset e escaneie um novo QR Code.');
  });

  nextClient.on('disconnected', (reason) => {
    isWhatsAppReady = false;
    console.log('WhatsApp desconectado:', reason);
    scheduleWhatsAppRestart(reason, 10000);
  });

  nextClient.on('ready', () => {
    isWhatsAppReady = true;
    initializeRetryCount = 0;
    console.log('\n🟢 Bot de WhatsApp conectado e pronto para receber mensagens!');
    console.log(`Numero monitorado: ${ownerWhatsAppNumber}`);
    console.log('Mercados monitorados automaticamente:');
    monitoredMarkets.forEach(({ market, phones }) => {
      console.log(`- ${market}: ${phones.join(' / ')}`);
    });
  });

  nextClient.on('message', (msg) => {
    handleWhatsAppMessage(msg).catch(error => {
      console.error('Erro inesperado ao processar mensagem do WhatsApp:', error);
    });
  });

  nextClient.on('message_create', (msg) => {
    if (!msg.fromMe) return;
    handleWhatsAppMessage(msg, { includeOwnMessages: true }).catch(error => {
      console.error('Erro inesperado ao processar mensagem enviada pelo WhatsApp:', error);
    });
  });
}

async function initializeWhatsAppClient() {
  isWhatsAppReady = false;
  console.log('🔄 Inicializando cliente do WhatsApp...');
  if (whatsappWebVersion) {
    console.log(`Usando WhatsApp Web ${whatsappWebVersion}.`);
  }
  if (initializeRetryCount > 0) {
    console.log(`Tentativa automatica de reconexao: ${initializeRetryCount + 1}.`);
  }

  const nextClient = new Client(buildClientOptions());
  client = nextClient;
  attachWhatsAppHandlers(nextClient);

  try {
    await nextClient.initialize();
  } catch (error) {
    console.error('Falha ao iniciar o WhatsApp Web:', error?.message || error);
    scheduleWhatsAppRestart(error, 10000);
  }
}

async function handleWhatsAppMessage(msg, {
  includeOwnMessages = false,
  suppressReplies = false,
  forcedMarket = null,
  forceReprocess = false
} = {}) {
  if (msg.fromMe && !includeOwnMessages) return;
  const messageId = msg.id?._serialized || `${msg.from}-${msg.timestamp}-${msg.body || ''}`;
  if (!forceReprocess && processedMessageIds.has(messageId)) return;
  processedMessageIds.add(messageId);
  const reply = async text => {
    if (!suppressReplies) await safeReply(msg, text);
  };

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
        await reply(`✅ Adicionado ${parsed.length} itens à lista do Radar de Preços!`);
      }
    } catch (err) {
      console.error('Erro ao processar lista do WhatsApp:', err);
      await reply('❌ Erro ao analisar lista. Verifique a chave de API.');
    }
  }

  // 2. Multimodal offer extraction from image
  if (msg.hasMedia) {
    if (!isWhatsAppReady) {
      console.log('Mídia recebida enquanto o WhatsApp Web ainda carregava. Aguardando finalizar...');
      await wait(8000);
    }

    const messageSource = getMessageSource(msg);
    const shouldProcessMedia =
      forcedMarket ||
      messageSource.isMonitoredMarket ||
      (msg.fromMe && includeOwnMessages) ||
      messageSource.isOwnerMessage;

    if (!shouldProcessMedia) {
      console.log(`Mídia ignorada: remetente fora da lista monitorada (${msg.author || msg.from}).`);
      return;
    }

    console.log('📩 Recebida imagem ou arquivo de mídia via WhatsApp...');
    try {
      if (!isWhatsAppReady) {
        throw new Error('WhatsApp Web ainda nao terminou de carregar.');
      }

      const media = await downloadMediaWithRetry(msg);
      console.log(`Mídia baixada: ${media.mimetype}${media.filename ? ` (${media.filename})` : ''}${media.filesize ? ` - ${media.filesize} bytes` : ''}`);
      const isImage = media.mimetype.startsWith('image/');
      const isPdf = media.mimetype === 'application/pdf';

      if (isImage || isPdf) {
        const chat = await msg.getChat();
        const fallbackMarket =
          forcedMarket ||
          messageSource.market ||
          chat?.name ||
          msg._data?.notifyName ||
          'WhatsApp encaminhado';
        const sourceLabel = isPdf ? 'PDF recebido pelo WhatsApp' : 'Imagem recebida pelo WhatsApp';
        const savedFilePath = saveIncomingMediaFile(media, fallbackMarket);
        console.log(`Arquivo salvo em: ${savedFilePath}`);
        await reply(`⏳ ${isPdf ? 'PDF' : 'Imagem'} recebido. Analisando ofertas automaticamente...`);

        const extractedOffers = await extractOffersFromMedia(media, fallbackMarket, sourceLabel);
        importedOffers.push(...extractedOffers);

        await reply(`✅ Sucesso! Extraídas ${extractedOffers.length} ofertas para o Radar de Preços.`);
      } else {
        await reply('Recebi a mídia, mas por enquanto processo automaticamente apenas imagens e PDFs de ofertas.');
      }
    } catch (err) {
      console.log(`Erro ao processar mídia do WhatsApp: ${getCompactError(err)}`);
      const errorMessage = String(err?.message || err || '');
      const isDownloadError =
        errorMessage.length <= 3 ||
        errorMessage.toLowerCase().includes('download') ||
        errorMessage.toLowerCase().includes('midia') ||
        errorMessage.toLowerCase().includes('media') ||
        errorMessage.toLowerCase().includes('mídia') ||
        errorMessage.toLowerCase().includes('carregar');

      if (isDownloadError) {
        await reply('❌ O WhatsApp Web não liberou esse arquivo para leitura automática. Encaminhe novamente como DOCUMENTO ou salve o PDF/imagem na pasta ENTRADA_OFERTAS.');
      } else {
        await reply('❌ Erro ao analisar a mídia com IA. Verifique a chave e tente novamente.');
      }
    }
  }
}

process.on('unhandledRejection', (reason) => {
  if (isTransientWhatsAppError(reason)) {
    scheduleWhatsAppRestart(reason, 10000);
    return;
  }

  console.error('Erro inesperado no coletor:', reason);
});

process.on('uncaughtException', (error) => {
  if (isTransientWhatsAppError(error)) {
    scheduleWhatsAppRestart(error, 10000);
    return;
  }

  console.error('Erro inesperado no coletor:', error);
});

initializeWhatsAppClient();
