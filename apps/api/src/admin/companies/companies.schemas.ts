import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { email, phone, required, sent, text, versionField, type Check } from '../admin-fields.js';
import { pageFields, sortField } from '../admin-list.js';

// The input of the company endpoints (V2-33, ADMIN.md §3.3). Field problems are the fixed codes of ADR-17.
export const MIN_NAME = 2;

const name: Check<string> = (raw) => {
  const result = text(120)(raw);
  if ('code' in result) return result;
  return result.value.length < MIN_NAME ? { code: 'TOO_SHORT' } : result;
};

// A field that may be left out: empty is "nothing" (`null`), anything else goes through the check.
const optional =
  <T>(check: Check<T>): Check<T | null> =>
  (raw) => {
    if (raw === undefined || raw === null) return { value: null };
    if (typeof raw === 'string' && raw.trim() === '') return { value: null };
    return check(raw);
  };

// The sales contact of the company: a name, an e-mail address and a phone number together, or nothing at all.
const salesContact: Check<{ name: string; email: string; phone: string } | null> = (raw) => {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { code: 'INVALID_FORMAT' };
  const both = raw as Record<string, unknown>;
  const given = [both.name, both.email, both.phone].filter((value) => typeof value === 'string' && value.trim() !== '');
  if (given.length === 0) return { value: null };
  if (given.length < 3) return { code: 'REQUIRED' };
  const parts = { name: text(80)(both.name), email: email(both.email), phone: phone(both.phone) };
  for (const part of [parts.name, parts.email, parts.phone]) if ('code' in part) return part;
  return { value: { name: (parts.name as { value: string }).value, email: (parts.email as { value: string }).value, phone: (parts.phone as { value: string }).value } };
};

const taxOffice = optional(text(80));
const city = optional(text(60));

export const createCompanySchema = z.object({
  name: required(name),
  taxOffice: field(taxOffice),
  city: field(city),
  phone: field(optional(phone)),
  salesContact: field(salesContact),
});

// A change names the version it was made against and only what it changes. To clear a field, send it empty.
export const updateCompanySchema = z.object({
  updatedAt: versionField(),
  name: sent(name),
  taxOffice: sent(taxOffice),
  city: sent(city),
  phone: sent(optional(phone)),
  salesContact: sent(salesContact),
});

const language: Check<'TR' | 'EN'> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: 'TR' };
  return raw === 'tr' ? { value: 'TR' } : raw === 'en' ? { value: 'EN' } : { code: 'INVALID_FORMAT' };
};

// The person invited: an e-mail address (it becomes their sign-in), a name, and their title. The language is the one of the
// invitation e-mail and of their account (`tr` when left out).
export const inviteUserSchema = z.object({
  email: required(email),
  firstName: required(text(60)),
  lastName: required(text(60)),
  title: field(optional(text(80))),
  locale: field(language),
});

export const COMPANY_SORT_FIELDS = ['name', 'createdAt', 'users'] as const;

export const listCompanySchema = z.object({
  ...pageFields,
  sort: sortField(COMPANY_SORT_FIELDS, { field: 'name', direction: 'asc' }),
  // A part of the name, the tax office or the city; case does not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
});
