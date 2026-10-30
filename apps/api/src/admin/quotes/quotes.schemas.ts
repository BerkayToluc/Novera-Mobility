import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { sent, versionField, type Check } from '../admin-fields.js';
import { pageFields, sortField } from '../admin-list.js';
import { QUOTE_SOURCES, QUOTE_STATUSES } from './quotes.view.js';

// The input of the quote endpoints (V2-32, ADMIN.md §3.2). Field problems are the fixed codes of ADR-17.
export const MAX_INTERNAL_NOTE = 2000;

const status: Check<(typeof QUOTE_STATUSES)[number]> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return typeof raw === 'string' && (QUOTE_STATUSES as readonly string[]).includes(raw)
    ? { value: raw as (typeof QUOTE_STATUSES)[number] }
    : { code: 'INVALID_FORMAT' };
};

// The note: text up to 2000 characters, trimmed. Empty or `null` clears it.
const note: Check<string | null> = (raw) => {
  if (raw === null) return { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  const value = raw.trim();
  if (value === '') return { value: null };
  return value.length > MAX_INTERNAL_NOTE ? { code: 'TOO_LONG' } : { value };
};

// A change names the version it was made against, and what it changes: the state, the note, or both. What it does not name stays.
export const updateQuoteSchema = z.object({
  updatedAt: versionField(),
  status: sent(status),
  internalNote: sent(note),
});

export const QUOTE_SORT_FIELDS = ['createdAt', 'number', 'vehicleCount'] as const;

const optionalChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

export const listQuoteSchema = z.object({
  ...pageFields,
  sort: sortField(QUOTE_SORT_FIELDS, { field: 'createdAt', direction: 'desc' }),
  // A part of the number, the company name or the e-mail address; case does not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  status: optionalChoice(QUOTE_STATUSES),
  source: optionalChoice(QUOTE_SOURCES),
});
