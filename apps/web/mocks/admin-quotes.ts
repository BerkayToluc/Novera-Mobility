import type { AdminQuote, AdminQuoteDetail, AdminQuotePage, QuoteStatusValue } from "@/lib/admin-quotes";
import { nextStatuses, statusRank } from "@/lib/admin-quotes";
import { normalizeSearch } from "@/lib/branch-detail";
import type { QuoteRequest } from "@/lib/quote-request";
import { fleetOf, nextVersion, type QuoteRecord } from "./fleet-world";
import { MOCK_QUOTE_REQUESTS } from "./quotes";

// The sample quote requests as the panel sees them (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the
// API's: a request only goes forward, a change carries the version it was made against, the note is staff's own. They live in the
// sample fleet of the world (mocks/fleet-world.ts), and the corporate sample account's own screen reads the state from there, so
// a request moved in the panel shows its new state to the customer.
const rows = (world: string): QuoteRecord[] => fleetOf(world).quotes;

const listItem = (row: QuoteRecord): AdminQuote => ({
  number: row.number,
  status: row.status,
  source: row.source,
  companyName: row.companyName,
  contactName: row.contactName,
  email: row.email,
  vehicleCount: row.vehicleCount,
  durationMonths: row.durationMonths,
  vehicleType: row.vehicleType,
  productSlug: row.productSlug,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  anonymized: row.anonymized,
});

const detail = (row: QuoteRecord): AdminQuoteDetail => ({
  ...listItem(row),
  id: row.id,
  phone: row.phone,
  deliveryCities: row.deliveryCities,
  notes: row.notes,
  internalNote: row.internalNote,
  account: row.accountEmail ? { email: row.accountEmail } : null,
  nextStatuses: nextStatuses(row.status),
});

type ListQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string; status: string | null; source: string | null };

export function listMockQuotes(world: string, query: ListQuery): AdminQuotePage {
  const needle = normalizeSearch(query.q);
  let items = rows(world).filter(
    (row) =>
      (!needle || normalizeSearch(`${row.number} ${row.companyName} ${row.email}`).includes(needle)) &&
      (!query.status || row.status === query.status) &&
      (!query.source || row.source === query.source),
  );
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  const by = (query.sort?.key ?? "createdAt") as "createdAt" | "number" | "vehicleCount";
  items = [...items].sort((a, b) => sign * (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0) || a.number.localeCompare(b.number));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize).map(listItem), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockQuote(world: string, number: string): AdminQuoteDetail | null {
  const found = rows(world).find((row) => row.number === number.toUpperCase());
  return found ? detail(found) : null;
}

export type MockOutcome =
  | { status: "ok"; value: AdminQuoteDetail }
  | { status: "stale" | "not_found" | "invalid_transition" }
  | { status: "invalid"; fields: Record<string, string> };

export function updateMockQuote(world: string, number: string, body: { updatedAt: string; status?: QuoteStatusValue; internalNote?: string | null }): MockOutcome {
  const current = rows(world).find((row) => row.number === number.toUpperCase());
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== body.updatedAt) return { status: "stale" };
  if (body.internalNote !== undefined && body.internalNote !== null && body.internalNote.length > 2000) return { status: "invalid", fields: { internalNote: "TOO_LONG" } };
  if (body.status !== undefined && statusRank(body.status) < statusRank(current.status)) return { status: "invalid_transition" };

  const moves = body.status !== undefined && body.status !== current.status;
  const note = body.internalNote === undefined ? undefined : (body.internalNote?.trim() || null);
  if (!moves && note === undefined) return { status: "ok", value: detail(current) };
  Object.assign(current, {
    ...(moves ? { status: body.status } : {}),
    ...(note !== undefined ? { internalNote: note } : {}),
    updatedAt: nextVersion(current.updatedAt),
  });
  return { status: "ok", value: detail(current) };
}

// The corporate sample account's own list: its three sample requests, in the state the panel left them in. The internal note is
// not part of what the customer reads.
export function mockQuoteRequestsFor(world: string): QuoteRequest[] {
  const states = new Map(rows(world).map((row) => [row.number, row.status]));
  return MOCK_QUOTE_REQUESTS.map((request) => ({ ...request, status: states.get(request.reference) ?? request.status }));
}
