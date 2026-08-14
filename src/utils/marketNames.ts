const KNOWN_MARKETS: Record<string, string> = {
  amigao: 'Amigão',
  atacadao: 'Atacadão',
  'atacadao ourinhos': 'Atacadão',
  max: 'Max',
  'max atacadista': 'Max',
  'sagrada familia': 'Sagrada Família',
  'sao judas': 'São Judas',
  'bom jesus': 'Bom Jesus',
  'bom preco': 'Bom Preço',
  'extra baratao': 'Extra Baratão',
  'compre bem': 'Compre Bem'
};

const SMALL_WORDS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

export const getMarketNameKey = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:supermercados?|mercados?|rede|loja)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeMarketName = (value: unknown, fallback = 'Mercado não informado'): string => {
  const key = getMarketNameKey(value);
  if (!key) return fallback;

  const knownName = KNOWN_MARKETS[key];
  if (knownName) return knownName;

  return key
    .split(' ')
    .map((word, index) => index > 0 && SMALL_WORDS.has(word)
      ? word
      : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};
