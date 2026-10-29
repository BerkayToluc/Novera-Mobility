import type { PromoCode, PromoCodePage, PromoStatus } from "@/lib/admin-promo";
import { normalizePromo } from "@/lib/promo-codes";

// The sample campaign codes (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's: the same
// states, the same refusals (taken name, a version that moved on, a code that is on a booking), and the booking summary in
// the sample mode takes its percentages from here, so a code made in the panel works at the payment step.
// The data lives on `globalThis`: the pages and the actions of one server process share it however Next splits the modules.
type Record_ = Omit<PromoCode, "status" | "deletable"> & { everUsed: boolean };
const DAY = 86_400_000;
const store = globalThis as typeof globalThis & { __noveraMockPromoCodes?: Record_[] };

function seed(): Record_[] {
  const now = Date.now();
  const iso = (offset: number) => new Date(now + offset * DAY).toISOString();
  const row = (code: string, percent: number, extra: Partial<Record_> = {}): Record_ => ({
    code,
    percent,
    active: true,
    validFrom: null,
    validUntil: null,
    maxRedemptions: null,
    oncePerUser: true,
    used: 0,
    everUsed: false,
    createdAt: iso(-60),
    updatedAt: iso(-60),
    ...extra,
  });
  return [
    row("NOVERA10", 10, { used: 4, everUsed: true, createdAt: iso(-50), updatedAt: iso(-50) }),
    row("HOSGELDIN", 5, { used: 1, everUsed: true, createdAt: iso(-40), updatedAt: iso(-40) }),
    row("KIS24", 20, { validUntil: iso(-30), used: 2, everUsed: true, createdAt: iso(-120), updatedAt: iso(-120) }),
    row("KAPALI15", 15, { active: false, createdAt: iso(-30), updatedAt: iso(-30) }),
    row("ILK5", 30, { maxRedemptions: 5, used: 5, everUsed: true, createdAt: iso(-20), updatedAt: iso(-20) }),
    row("YAKINDA12", 12, { validFrom: iso(10), createdAt: iso(-10), updatedAt: iso(-10) }),
  ];
}

const rows = (): Record_[] => (store.__noveraMockPromoCodes ??= seed());

export function promoStatusOf(code: Pick<Record_, "active" | "validFrom" | "validUntil" | "maxRedemptions" | "used">, now = Date.now()): PromoStatus {
  if (!code.active) return "INACTIVE";
  if (code.validUntil && now >= Date.parse(code.validUntil)) return "EXPIRED";
  if (code.maxRedemptions !== null && code.used >= code.maxRedemptions) return "EXHAUSTED";
  if (code.validFrom && now < Date.parse(code.validFrom)) return "SCHEDULED";
  return "ACTIVE";
}

const view = ({ everUsed, ...code }: Record_): PromoCode => ({ ...code, deletable: !everUsed, status: promoStatusOf(code) });

type ListQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string; status: string | null };

export function listMockPromoCodes(query: ListQuery): PromoCodePage {
  const needle = query.q.toLocaleUpperCase("en").replace(/\s+/g, "");
  let items = rows().map(view).filter((row) => (!needle || row.code.includes(needle)) && (!query.status || row.status === query.status));
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  const key = (row: PromoCode): number | string => {
    const by = query.sort?.key ?? "createdAt";
    if (by === "validUntil") return row.validUntil ? Date.parse(row.validUntil) : Number.POSITIVE_INFINITY;
    return by === "code" ? row.code : by === "percent" ? row.percent : by === "used" ? row.used : row.createdAt;
  };
  items = [...items].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || a.code.localeCompare(b.code));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockPromoCode(code: string): PromoCode | null {
  const found = rows().find((row) => row.code === normalizePromo(code));
  return found ? view(found) : null;
}

export type MockOutcome<T> = { status: "ok"; value: T } | { status: "taken" | "stale" | "in_use" | "not_found" } | { status: "invalid"; fields: Record<string, string> };

export function createMockPromoCode(body: { code: string; percent: number; active?: boolean; validFrom?: string | null; validUntil?: string | null; maxRedemptions?: number | null; oncePerUser?: boolean }): MockOutcome<PromoCode> {
  if (rows().some((row) => row.code === body.code)) return { status: "taken" };
  if (body.validFrom && body.validUntil && Date.parse(body.validUntil) <= Date.parse(body.validFrom)) {
    return { status: "invalid", fields: { validUntil: "INVALID_DATE_RANGE" } };
  }
  const now = new Date().toISOString();
  const created: Record_ = {
    code: body.code,
    percent: body.percent,
    active: body.active ?? true,
    validFrom: body.validFrom ?? null,
    validUntil: body.validUntil ?? null,
    maxRedemptions: body.maxRedemptions ?? null,
    oncePerUser: body.oncePerUser ?? true,
    used: 0,
    everUsed: false,
    createdAt: now,
    updatedAt: now,
  };
  rows().push(created);
  return { status: "ok", value: view(created) };
}

export function updateMockPromoCode(code: string, body: { updatedAt: string; percent?: number; active?: boolean; validFrom?: string | null; validUntil?: string | null; maxRedemptions?: number | null; oncePerUser?: boolean }): MockOutcome<PromoCode> {
  const current = rows().find((row) => row.code === normalizePromo(code));
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== body.updatedAt) return { status: "stale" };
  const next = {
    validFrom: body.validFrom === undefined ? current.validFrom : body.validFrom,
    validUntil: body.validUntil === undefined ? current.validUntil : body.validUntil,
    maxRedemptions: body.maxRedemptions === undefined ? current.maxRedemptions : body.maxRedemptions,
  };
  if (next.validFrom && next.validUntil && Date.parse(next.validUntil) <= Date.parse(next.validFrom)) {
    return { status: "invalid", fields: { validUntil: "INVALID_DATE_RANGE" } };
  }
  if (next.maxRedemptions !== null && next.maxRedemptions < current.used) {
    return { status: "invalid", fields: { maxRedemptions: "BELOW_USAGE" } };
  }
  Object.assign(current, next, {
    percent: body.percent ?? current.percent,
    active: body.active ?? current.active,
    oncePerUser: body.oncePerUser ?? current.oncePerUser,
    // A tick later than the version that was read, so two quick edits never share one.
    updatedAt: new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString(),
  });
  return { status: "ok", value: view(current) };
}

export function deleteMockPromoCode(code: string): MockOutcome<null> {
  const list = rows();
  const index = list.findIndex((row) => row.code === normalizePromo(code));
  if (index < 0) return { status: "not_found" };
  if (list[index]!.everUsed) return { status: "in_use" };
  list.splice(index, 1);
  return { status: "ok", value: null };
}

// What the sample booking summary takes off: the percent of a code that works right now, or null.
export function mockPromoPercent(code: string): number | null {
  const found = rows().find((row) => row.code === code);
  return found && promoStatusOf(found) === "ACTIVE" ? found.percent : null;
}
