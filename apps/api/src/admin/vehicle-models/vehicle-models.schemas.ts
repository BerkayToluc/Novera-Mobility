import { z } from 'zod';
import { checkOptionalImageUrl } from '../../common/image-url.js';
import { field } from '../../common/zod-fields.js';
import { required, sent, text, versionField, type Check } from '../admin-fields.js';
import { pageFields, sortField } from '../admin-list.js';
import { FUEL_TYPES, MODEL_STATUSES, TRANSMISSIONS } from './vehicle-models.view.js';

// The input of the vehicle model endpoints (V2-29, ADMIN.md §3.1). Field problems are the fixed codes of ADR-17.
export const MAX_DAILY_PRICE = 10_000_000; // ₺100.000 a day, in kuruş: a typo guard, not a business rule
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slug: Check<string> = (raw) => {
  const result = text(60)(raw);
  if ('code' in result) return result;
  return result.value.length >= 3 && SLUG.test(result.value) ? result : { code: 'INVALID_FORMAT' };
};

const choice =
  <T extends string>(values: readonly T[]): Check<T> =>
  (raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  };

const wholeNumber =
  (min: number, max: number): Check<number> =>
  (raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
    return raw < min || raw > max ? { code: 'OUT_OF_RANGE' } : { value: raw };
  };

// Litres or kWh per 100 km: above zero, and not more than a car could burn.
const consumption: Check<number> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { code: 'INVALID_FORMAT' };
  return raw <= 0 || raw > 100 ? { code: 'OUT_OF_RANGE' } : { value: Math.round(raw * 10) / 10 };
};

// Both languages, each of them text: the site shows whichever the visitor reads.
const description: Check<{ tr: string; en: string }> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { code: 'INVALID_FORMAT' };
  const both = raw as Record<string, unknown>;
  const tr = text(1000)(both.tr);
  const en = text(1000)(both.en);
  if ('code' in tr) return tr;
  if ('code' in en) return en;
  return { value: { tr: tr.value, en: en.value } };
};

// The class by its slug; that it exists is checked against the database (UNKNOWN_REFERENCE).
const classSlug: Check<string> = (raw) => {
  const result = text(60)(raw);
  return 'code' in result ? result : SLUG.test(result.value) ? result : { code: 'INVALID_FORMAT' };
};

// A new model. The slug may be left out: it is made from the name (`slugOf`) and has to be free.
export const createModelSchema = z.object({
  brand: required(text(40)),
  model: required(text(60)),
  slug: field<string | null>((raw) => (raw === undefined || raw === null || raw === '' ? { value: null } : slug(raw))),
  classSlug: required(classSlug),
  fuelType: required(choice(FUEL_TYPES)),
  transmission: required(choice(TRANSMISSIONS)),
  seats: required(wholeNumber(1, 9)),
  bags: required(wholeNumber(0, 10)),
  consumption: required(consumption),
  dailyPrice: required(wholeNumber(1, MAX_DAILY_PRICE)),
  description: required(description),
  imageUrl: field<string | null>((raw) => (raw === undefined ? { value: null } : checkOptionalImageUrl(raw))),
});

// The address of a model never changes, so that `?arac=` links keep working: sending a `slug` with a change is refused, not
// ignored. (Everything else a change does not name stays as it is.)
const never: Check<undefined> = (raw) => (raw === undefined ? { value: undefined } : { code: 'NOT_ALLOWED' });

export const updateModelSchema = z.object({
  updatedAt: versionField(),
  slug: field<undefined>(never),
  brand: sent(text(40)),
  model: sent(text(60)),
  classSlug: sent(classSlug),
  fuelType: sent(choice(FUEL_TYPES)),
  transmission: sent(choice(TRANSMISSIONS)),
  seats: sent(wholeNumber(1, 9)),
  bags: sent(wholeNumber(0, 10)),
  consumption: sent(consumption),
  dailyPrice: sent(wholeNumber(1, MAX_DAILY_PRICE)),
  description: sent(description),
  // `null` is "no picture": the site draws a placeholder again.
  imageUrl: field<string | null | undefined>((raw) => (raw === undefined ? { value: undefined } : checkOptionalImageUrl(raw))),
});

export const MODEL_SORT_FIELDS = ['name', 'dailyPrice', 'activeVehicles', 'createdAt'] as const;

const optionalChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

export const listModelSchema = z.object({
  ...pageFields,
  sort: sortField(MODEL_SORT_FIELDS, { field: 'name', direction: 'asc' }),
  // A part of the brand, model or address; case and Turkish letters do not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  // The class by its slug; one that does not exist simply finds nothing.
  class: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && SLUG.test(raw) && raw.length <= 60 ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  fuel: optionalChoice(FUEL_TYPES),
  status: optionalChoice(MODEL_STATUSES),
});
