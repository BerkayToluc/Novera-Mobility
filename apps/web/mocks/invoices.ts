import type { Invoice, InvoiceLine, InvoicePage, InvoiceStatus } from "@/lib/invoices";
import { isPeriod } from "@/lib/invoices";
import { normalizeSearch } from "@/lib/branch-detail";
import { getMockCompany } from "./admin-companies";
import { listMockBillingContracts } from "./admin-contracts";

// The sample invoices (USE_MOCKS=1, local work and tests only, lib/mock-world.ts). They behave like the API's: an invoice is for one
// company and one month, a month is made once, the lines add up to the invoice to the kuruş, "late" is worked out from the due day, and a
// change carries the version it was made against. The rule for the amounts is the one in apps/api/src/fleet/invoice-calc.ts.
//
// Kept per "world" on `globalThis`, like the contracts: a test that makes the invoices works in a world of its own.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const DAY = 86_400_000;
const VAT_PERCENT = 20;
const DUE_DAYS = 30;

type Stored = Omit<Invoice, "status" | "company">  & { companyId: string };
type World = { invoices: Stored[]; serial: number };

const store = globalThis as typeof globalThis & { __noveraMockInvoices?: Map<string, World> };
const MAX_WORLDS = 60;

const todayOf = (): string => new Date().toISOString().slice(0, 10);
const dayAfter = (day: string, offset: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
const monthsAgo = (count: number): string => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - count, 1)).toISOString().slice(0, 7);
const nextVersion = (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();

// The month as its first day, its last day and its number of days.
function range(period: string) {
  const start = `${period}-01`;
  const next = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1));
  const daysInMonth = Math.round((next.getTime() - Date.parse(`${start}T00:00:00Z`)) / DAY);
  return { start, end: dayAfter(start, daysInMonth - 1), daysInMonth };
}

// Whole kuruş, half up, with integers only (the API's rule).
const proRate = (fee: number, days: number, daysInMonth: number) => Math.floor((fee * days * 2 + daysInMonth) / (daysInMonth * 2));

function totals(lines: Array<Pick<InvoiceLine, "amount">>) {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const vat = Math.floor((subtotal * VAT_PERCENT * 2 + 100) / 200);
  return { subtotal, vat, total: subtotal + vat };
}

function linesOf(name: string, companyId: string, period: string): InvoiceLine[] {
  const month = range(period);
  return listMockBillingContracts(name)
    .filter((c) => c.companyId === companyId)
    .flatMap((c): InvoiceLine[] => {
      const from = c.startAt > month.start ? c.startAt : month.start;
      const to = c.endAt < month.end ? c.endAt : month.end;
      if (to < from) return [];
      const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
      return [{ contractNumber: c.number, productSlug: c.productSlug, days, daysInMonth: month.daysInMonth, amount: proRate(c.monthlyFee, days, month.daysInMonth) }];
    });
}

function make(n: number, companyId: string, period: string, issuedAt: string, lines: InvoiceLine[], paidAt: string | null): Stored {
  return {
    id: `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    number: `FTR-${issuedAt.slice(0, 4)}-${String(n).padStart(5, "0")}`,
    companyId,
    period,
    issuedAt,
    dueAt: dayAfter(issuedAt, DUE_DAYS),
    lines,
    ...totals(lines),
    vatPercent: VAT_PERCENT,
    paidAt,
    createdAt: `${issuedAt}T09:00:00.000Z`,
    updatedAt: `${issuedAt}T09:00:00.000Z`,
  };
}

// The sample company has three months behind it: the oldest is paid, the middle one is late, the last one is waiting. The dates move
// with today, so what the state is does not depend on the day the test runs.
function seed(name: string): World {
  const invoices: Stored[] = [];
  const plan: Array<[number, number, boolean]> = [
    [3, -100, true],
    [2, -60, false],
    [1, -10, false],
  ];
  plan.forEach(([ago, issued, paid], index) => {
    const period = monthsAgo(ago);
    const lines = linesOf(name, EGE, period);
    if (lines.length === 0) return;
    const issuedAt = dayAfter(todayOf(), issued);
    invoices.push(make(index + 1, EGE, period, issuedAt, lines, paid ? `${dayAfter(issuedAt, 12)}T10:00:00.000Z` : null));
  });
  return { invoices, serial: 3 };
}

function world(name: string): World {
  const worlds = (store.__noveraMockInvoices ??= new Map());
  let found = worlds.get(name);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed(name);
    worlds.set(name, found);
  }
  return found;
}

function statusOf(row: Stored): InvoiceStatus {
  if (row.paidAt) return "PAID";
  return row.dueAt < todayOf() ? "OVERDUE" : "PENDING";
}

function view(name: string, row: Stored): Invoice {
  const { companyId, ...rest } = row;
  return { ...rest, company: { id: companyId, name: getMockCompany(name, companyId)?.name ?? "—" }, status: statusOf(row) };
}

type Sort = { key: string; dir: "asc" | "desc" } | null;
function sorted(rows: Stored[], sort: Sort): Stored[] {
  const sign = sort?.dir === "asc" ? 1 : -1;
  const by = (sort?.key ?? "issuedAt") as "issuedAt" | "dueAt" | "number" | "total" | "period";
  return [...rows].sort((a, b) => sign * (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0) || a.id.localeCompare(b.id));
}

const pageOf = (all: Invoice[], page: number, pageSize: number): InvoicePage => ({ items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize });

type ListQuery = { page: number; pageSize: number; sort: Sort; q: string; status: InvoiceStatus | null };

export function listMockInvoices(name: string, query: ListQuery, companyId: string | null = null): InvoicePage {
  const words = normalizeSearch(query.q).split(/\s+/).filter(Boolean);
  const rows = world(name).invoices.filter((row) => {
    if (companyId !== null && row.companyId !== companyId) return false;
    if (query.status && statusOf(row) !== query.status) return false;
    const haystack = normalizeSearch(`${row.number} ${getMockCompany(name, row.companyId)?.name ?? ""}`);
    return words.every((word) => haystack.includes(word));
  });
  return pageOf(sorted(rows, query.sort).map((row) => view(name, row)), query.page, query.pageSize);
}

// `companyId` narrows to one company's invoices (the customer's screens): another company's is not found.
export function getMockInvoice(name: string, number: string, companyId: string | null = null): Invoice | null {
  const row = world(name).invoices.find((entry) => entry.number === number.toUpperCase() && (companyId === null || entry.companyId === companyId));
  return row ? view(name, row) : null;
}

export type GenerateOutcome = { status: "ok"; period: string; created: number } | { status: "already" | "future" | "invalid" };

export function generateMockInvoices(name: string, period: string): GenerateOutcome {
  if (!isPeriod(period)) return { status: "invalid" };
  if (range(period).start > todayOf()) return { status: "future" };
  const w = world(name);
  if (w.invoices.some((row) => row.period === period)) return { status: "already" };
  const companies = [...new Set(listMockBillingContracts(name).map((c) => c.companyId))].sort();
  let created = 0;
  for (const companyId of companies) {
    const lines = linesOf(name, companyId, period);
    if (lines.length === 0) continue;
    w.serial += 1;
    w.invoices.push(make(w.serial, companyId, period, todayOf(), lines, null));
    created += 1;
  }
  return { status: "ok", period, created };
}

export type PaidOutcome = { status: "ok"; value: Invoice } | { status: "stale" | "not_found" };

export function setMockInvoicePaid(name: string, number: string, updatedAt: string, paid: boolean): PaidOutcome {
  const row = world(name).invoices.find((entry) => entry.number === number.toUpperCase());
  if (!row) return { status: "not_found" };
  if (row.updatedAt !== updatedAt) return { status: "stale" };
  if ((row.paidAt !== null) !== paid) Object.assign(row, { paidAt: paid ? new Date().toISOString() : null, updatedAt: nextVersion(row.updatedAt) });
  return { status: "ok", value: view(name, row) };
}

// What the Filom summary shows: this month's invoice, and what is still to be paid.
export function invoiceSummary(name: string, companyId: string) {
  const rows = world(name).invoices.filter((row) => row.companyId === companyId);
  const thisMonth = rows.find((row) => row.period === todayOf().slice(0, 7));
  const unpaid = rows.filter((row) => row.paidAt === null);
  return {
    thisMonth: thisMonth ? { number: thisMonth.number, total: thisMonth.total, status: statusOf(thisMonth) } : null,
    unpaid: { count: unpaid.length, total: unpaid.reduce((sum, row) => sum + row.total, 0) },
    overdue: unpaid.filter((row) => statusOf(row) === "OVERDUE").length,
  };
}
