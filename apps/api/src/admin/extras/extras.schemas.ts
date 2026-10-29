import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { sent, text, versionField, type Check } from '../admin-fields.js';

// The input of the extra service endpoints (V2-30). Only the name and the price change; the address and how it is priced do not.
export const MAX_EXTRA_PRICE = 1_000_000; // ₺10.000, in kuruş: a typo guard, not a business rule

const price: Check<number> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
  return raw < 0 || raw > MAX_EXTRA_PRICE ? { code: 'OUT_OF_RANGE' } : { value: raw };
};

// Both languages, each of them text: the site shows whichever the visitor reads.
const name: Check<{ tr: string; en: string }> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { code: 'INVALID_FORMAT' };
  const both = raw as Record<string, unknown>;
  const tr = text(80)(both.tr);
  const en = text(80)(both.en);
  if ('code' in tr) return tr;
  if ('code' in en) return en;
  return { value: { tr: tr.value, en: en.value } };
};

const never: Check<undefined> = (raw) => (raw === undefined ? { value: undefined } : { code: 'NOT_ALLOWED' });

export const updateExtraSchema = z.object({
  updatedAt: versionField(),
  slug: field<undefined>(never),
  pricing: field<undefined>(never),
  name: sent(name),
  price: sent(price),
});
