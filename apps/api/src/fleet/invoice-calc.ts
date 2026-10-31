import { DAY_MS } from '../common/time.js';
import { addDays, dayOf, daysBetween, parseDay } from './fleet-dates.js';

// How a monthly invoice is worked out (V2-37, docs/ADMIN.md §3.15). Pure, so the rule is tested without a database; the seed uses it too.
//
// The rule, in words:
// - An invoice is for one company and one month (the period, "2026-10").
// - A contract is billed for the days it covers in that month, both of its end days included: from the later of its start day and the 1st,
//   to the earlier of its end day and the last day of the month. A contract that does not touch the month has no line. The date range of
//   the contract is what counts, whatever its state (ending a contract early means setting its end day to the last day it is billed).
// - The line is the monthly fee for the days covered, out of the days of the month, rounded to the kuruş (half up). A whole month is the
//   monthly fee exactly.
// - The subtotal is the sum of the lines, so the lines add up to the invoice to the kuruş. VAT is 20 % of the subtotal, rounded half up.
//   The total is the subtotal plus the VAT.
// - It is issued on the day it is made and is due 30 days later.
export const VAT_PERCENT = 20;
export const DUE_DAYS = 30;

export type InvoiceLine = {
  contractNumber: string;
  productSlug: string;
  // The days of the month the contract covers, and the days the month has.
  days: number;
  daysInMonth: number;
  // TRY kuruş.
  amount: number;
};

export type InvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE';

// "2026-10" as its first and last day (00:00 UTC, the way the `date` columns are read) and its number of days; `null` for what is not a
// month.
export function periodRange(period: string): { start: Date; end: Date; daysInMonth: number } | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const start = parseDay(`${period}-01`);
  if (!start) return null;
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const daysInMonth = daysBetween(start, next);
  return { start, end: addDays(next, -1), daysInMonth };
}

// The days a contract covers in the month, 0 when it does not touch it.
export function billableDays(contract: { startAt: Date; endAt: Date }, range: { start: Date; end: Date }): number {
  const from = Math.max(contract.startAt.getTime(), range.start.getTime());
  const to = Math.min(contract.endAt.getTime(), range.end.getTime());
  return to < from ? 0 : Math.round((to - from) / DAY_MS) + 1;
}

// Whole kuruş, half up, with integers only: fee × days ÷ days of the month.
export const proRate = (monthlyFee: number, days: number, daysInMonth: number): number => Math.floor((monthlyFee * days * 2 + daysInMonth) / (daysInMonth * 2));

export function lineOf(contract: { number: string; productSlug: string; monthlyFee: number; startAt: Date; endAt: Date }, range: { start: Date; end: Date; daysInMonth: number }): InvoiceLine | null {
  const days = billableDays(contract, range);
  if (days === 0) return null;
  return { contractNumber: contract.number, productSlug: contract.productSlug, days, daysInMonth: range.daysInMonth, amount: proRate(contract.monthlyFee, days, range.daysInMonth) };
}

export function totalsOf(lines: ReadonlyArray<Pick<InvoiceLine, 'amount'>>): { subtotal: number; vat: number; total: number } {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const vat = Math.floor((subtotal * VAT_PERCENT * 2 + 100) / 200);
  return { subtotal, vat, total: subtotal + vat };
}

// Paid, waiting, or late. "Late" is not stored: an invoice that is not paid and whose due day has passed (before `today`) is late.
export function invoiceStatus(invoice: { paidAt: Date | null; dueAt: Date }, today: Date): InvoiceStatus {
  if (invoice.paidAt) return 'PAID';
  return invoice.dueAt.getTime() < today.getTime() ? 'OVERDUE' : 'PENDING';
}

// The due day of an invoice issued on `issuedAt`.
export const dueDayOf = (issuedAt: Date): string => dayOf(addDays(issuedAt, DUE_DAYS))!;
