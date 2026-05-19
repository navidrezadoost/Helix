import type { FieldConfig } from '../types/schema';

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
export const FLEX_WIDTH_PRESETS = [25, 50, 75, 100] as const;

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const normalizeToken = (value: string, fallback: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
};

const getRandomByte = () => Math.floor(Math.random() * 256);

const encodeTime = (timestamp: number, length: number) => {
  let value = timestamp;
  const output = Array.from({ length }, () => ULID_ALPHABET[0]);

  for (let index = length - 1; index >= 0; index -= 1) {
    output[index] = ULID_ALPHABET[value % 32] ?? ULID_ALPHABET[0];
    value = Math.floor(value / 32);
  }

  return output.join('');
};

export const createUlid = () => {
  const timestamp = encodeTime(Date.now(), 10);
  const randomValues = new Uint8Array(16);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomValues);
  } else {
    randomValues.forEach((_, index) => {
      randomValues[index] = getRandomByte();
    });
  }

  const randomness = Array.from(randomValues, (value) => ULID_ALPHABET[value % 32]).join('');
  return `${timestamp}${randomness}`;
};

export const normalizeFieldName = (value: string, fallback = 'field') => normalizeToken(value, fallback);

export const normalizeOptionValue = (value: string, fallback = 'option') => normalizeToken(value, fallback);

export const createFieldId = (value: string, fallback = 'field') => `${normalizeFieldName(value, fallback)}_${createUlid()}`;

export const getFieldKey = (field: FieldConfig) => field.name?.trim() || field.id;

export const getDateFormatPlaceholder = (format?: string) => format?.trim() || DEFAULT_DATE_FORMAT;

export const parseIsoDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const parsedDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
};

export const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateValue = (
  value: unknown,
  format = DEFAULT_DATE_FORMAT,
  locale = 'en',
) => {
  const parsedDate = parseIsoDate(value);

  if (!parsedDate) {
    return '';
  }

  const longMonth = new Intl.DateTimeFormat(locale, { month: 'long' }).format(parsedDate);
  const shortMonth = new Intl.DateTimeFormat(locale, { month: 'short' }).format(parsedDate);
  const numericMonth = `${parsedDate.getMonth() + 1}`;
  const paddedMonth = numericMonth.padStart(2, '0');
  const numericDay = `${parsedDate.getDate()}`;
  const paddedDay = numericDay.padStart(2, '0');
  const fullYear = `${parsedDate.getFullYear()}`;
  const shortYear = fullYear.slice(-2);

  return format
    .replace(/YYYY/g, fullYear)
    .replace(/YY/g, shortYear)
    .replace(/MMMM/g, longMonth)
    .replace(/MMM/g, shortMonth)
    .replace(/MM/g, paddedMonth)
    .replace(/M/g, numericMonth)
    .replace(/DD/g, paddedDay)
    .replace(/D/g, numericDay);
};
