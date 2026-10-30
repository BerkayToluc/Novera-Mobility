import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { pageFields, sortField } from '../admin-list.js';

// The input of the contact message endpoints (V2-32, ADMIN.md §3.2). Field problems are the fixed codes of ADR-17.

// Handled or not: a real true or false. Missing is REQUIRED.
export const handleMessageSchema = z.object({
  handled: field<boolean>((raw) => {
    if (raw === undefined || raw === null) return { code: 'REQUIRED' };
    return typeof raw === 'boolean' ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
});

export const MESSAGE_SORT_FIELDS = ['createdAt'] as const;

export const listMessageSchema = z.object({
  ...pageFields,
  sort: sortField(MESSAGE_SORT_FIELDS, { field: 'createdAt', direction: 'desc' }),
  // A part of the name, the e-mail address or the subject; case does not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  // `false` is the messages still waiting (not handled, and not anonymised: nothing is left to answer in those), `true` the handled ones.
  handled: field<boolean | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (raw === 'true') return { value: true };
    return raw === 'false' ? { value: false } : { code: 'INVALID_FORMAT' };
  }),
});
