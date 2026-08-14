const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseOfferDate = (value?: string): Date | null => {
  if (!value) return null;
  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

export const sanitizeOfferDate = (value: unknown): string | undefined => {
  const text = String(value || '').trim();
  return parseOfferDate(text) ? text : undefined;
};

export const getTodayDateOnly = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const formatOfferDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayOfferDate = () => formatOfferDate(new Date());

export const isOfferExpired = (value?: string) => {
  const endDate = parseOfferDate(value);
  return endDate ? endDate < getTodayDateOnly() : false;
};

export const normalizeOfferDateRange = <T extends { startDate?: string; endDate?: string }>(item: T): T => {
  const startDate = sanitizeOfferDate(item.startDate);
  const endDate = sanitizeOfferDate(item.endDate);

  if (startDate && endDate && endDate < startDate) {
    return { ...item, startDate: undefined, endDate: undefined };
  }

  return { ...item, startDate, endDate };
};
