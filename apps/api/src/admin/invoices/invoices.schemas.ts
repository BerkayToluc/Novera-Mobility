import { z } from 'zod';
import { isUuid } from '../../common/uuid.js';
import { field } from '../../common/zod-fields.js';
import { periodRange } from '../../fleet/invoice-calc.js';
import { versionField, type Check } from '../admin-fields.js';
import { pageFields, sortField } from '../admin-list.js';

// The input of the invoice endpoints of the administration (V2-37, docs/ADMIN.md §3.15). Field problems are the fixed codes of ADR-17.

// A month as people write it, "2026-10", that is a real one between 2000 and 2100.
export const month: Check<string> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'string' || !periodRange(raw)) return { code: 'INVALID_FORMAT' };
  const year = Number(raw.slice(0, 4));
  return year >= 2000 && year <= 2100 ? { value: raw } : { code: 'INVALID_FORMAT' };
};

// What `POST /admin/invoices/generate?period=...` takes: only the month, in the query.
export const generateInvoicesSchema = z.object({ period: field(month) });

export const INVOICE_STATUSES = ['PAID', 'PENDING', 'OVERDUE'] as const;

// Paid or not: the one change an invoice takes. It names the version it was made against.
const paid: Check<boolean> = (raw) => {
  if (raw === undefined || raw === null) return { code: 'REQUIRED' };
  return typeof raw === 'boolean' ? { value: raw } : { code: 'INVALID_FORMAT' };
};
export const updateInvoiceSchema = z.object({ updatedAt: versionField(), paid: field(paid) });

export const INVOICE_SORT_FIELDS = ['issuedAt', 'dueAt', 'number', 'total'] as const;

const optionalChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

export const listInvoiceSchema = z.object({
  ...pageFields,
  sort: sortField(INVOICE_SORT_FIELDS, { field: 'issuedAt', direction: 'desc' }),
  // A part of the number or of the company's name; case does not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  period: field<string | null>((raw) => (raw === undefined || raw === null || raw === '' ? { value: null } : month(raw))),
  company: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  status: optionalChoice(INVOICE_STATUSES),
});
