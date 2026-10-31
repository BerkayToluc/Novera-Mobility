import type { Prisma } from '../generated/prisma/client.js';
import { dayOf } from './fleet-dates.js';
import { invoiceStatus, VAT_PERCENT, type InvoiceLine, type InvoiceStatus } from './invoice-calc.js';

// What an invoice looks like on the screens, for the customer (`/fleet/invoices`) and for the administrator (`/admin/invoices`) alike
// (V2-37, docs/FLEET.md §4). Money is TRY kuruş. The days are calendar days, "2026-10-31". The state is worked out from the due day when
// it is read, never stored.
export const INVOICE_INCLUDE = { company: { select: { id: true, name: true } } } satisfies Prisma.FleetInvoiceInclude;
export type InvoiceRow = Prisma.FleetInvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

export type InvoiceView = {
  id: string;
  number: string;
  company: { id: string; name: string };
  period: string;
  issuedAt: string;
  dueAt: string;
  lines: InvoiceLine[];
  subtotal: number;
  vatPercent: number;
  vat: number;
  total: number;
  paidAt: string | null;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
};

// The lines are JSON in the row; one whose shape is wrong is left out instead of breaking the page that lists the invoice.
export function readLines(value: unknown): InvoiceLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): InvoiceLine[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const line = entry as Record<string, unknown>;
    return typeof line.contractNumber === 'string' && typeof line.productSlug === 'string' && Number.isInteger(line.days) && Number.isInteger(line.daysInMonth) && Number.isInteger(line.amount)
      ? [{ contractNumber: line.contractNumber, productSlug: line.productSlug, days: line.days as number, daysInMonth: line.daysInMonth as number, amount: line.amount as number }]
      : [];
  });
}

// `today` is the Istanbul calendar day as a Date at 00:00 UTC, the same form the `date` columns have.
export const invoiceView = (row: InvoiceRow, today: Date): InvoiceView => ({
  id: row.id,
  number: row.number,
  company: row.company,
  period: row.period,
  issuedAt: dayOf(row.issuedAt)!,
  dueAt: dayOf(row.dueAt)!,
  lines: readLines(row.lines),
  subtotal: row.subtotal,
  vatPercent: VAT_PERCENT,
  vat: row.vat,
  total: row.total,
  paidAt: row.paidAt?.toISOString() ?? null,
  status: invoiceStatus(row, today),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// A number in the path, as it is stored: capitals. Something that cannot be a number is a record that does not exist.
export const INVOICE_NUMBER = /^FTR-\d{4}-\d{5,}$/;
export const normalizeInvoiceNumber = (raw: string): string | null => {
  const number = raw.trim().toUpperCase();
  return INVOICE_NUMBER.test(number) ? number : null;
};
