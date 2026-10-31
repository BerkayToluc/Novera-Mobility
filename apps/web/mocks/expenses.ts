import { normalizePlate } from "@/lib/admin-vehicles";
import { assigneeAt, canMove, type ExpenseFormValues, type ExpenseStatus, type ExpenseType, type FleetExpense, type FleetExpensePage, isMoment, momentToIso } from "@/lib/expenses";
import { feeToKurus } from "@/lib/admin-contracts";
import { getMockCompany } from "./admin-companies";
import { getMockContract, listMockCompanyCars } from "./admin-contracts";
import { fleetOf, nextVersion } from "./fleet-world";
import { assignmentSpans } from "./fleet-panel";

// The sample expenses (USE_MOCKS=1, local work and tests only, lib/mock-world.ts). They behave like the API's: an expense is for the car
// that has the plate, its company is the car's, the person is whoever had the car at that moment (worked out, never stored), an open
// expense can be reflected or disputed, a reflected one is final, and a change carries the version it was made against.
//
// Kept per "world" on `globalThis`, like the contracts: a test that changes an expense works in a world of its own.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const CAR_101 = "7c000000-0000-4000-8000-000000000001";
const CAR_102 = "7c000000-0000-4000-8000-000000000002";
const DAY = 86_400_000;

type Stored = Omit<FleetExpense, "company" | "vehicle" | "employee"> & { companyId: string; vehicleId: string };
type World = { expenses: Stored[] };

const store = globalThis as typeof globalThis & { __noveraMockExpenses?: Map<string, World> };
const MAX_WORLDS = 60;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();

// Ayşe has had 35 FLM 101 for sixty days; Burak had 35 FLM 102 from ninety days ago until thirty-five days ago. So there are expenses of
// either person, one from before the first handover and one from the gap after the second, which have nobody.
function seed(): World {
  let n = 0;
  const make = (vehicleId: string, type: ExpenseType, amount: number, occurredAt: string, extra: Partial<Stored> = {}): Stored => {
    n += 1;
    return {
      id: `b1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      companyId: EGE,
      vehicleId,
      type,
      occurredAt,
      amount,
      description: type === "HGS" ? "HGS geçişi" : type === "PENALTY" ? "Hız sınırı ihlali" : type === "MAINTENANCE" ? "Periyodik bakım" : null,
      place: type === "HGS" ? "Avrasya Tüneli" : null,
      status: "OPEN",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      ...extra,
    };
  };
  return {
    expenses: [
      make(CAR_101, "HGS", 8_550, ago(3)),
      make(CAR_101, "HGS", 12_000, ago(12)),
      make(CAR_101, "PENALTY", 119_000, ago(20)),
      make(CAR_101, "HGS", 6_400, ago(30), { status: "DISPUTED" }),
      make(CAR_101, "HGS", 9_900, ago(40), { status: "REFLECTED" }),
      make(CAR_101, "MAINTENANCE", 185_000, ago(70)),
      make(CAR_102, "HGS", 7_300, ago(50)),
      make(CAR_102, "PENALTY", 135_000, ago(45)),
      make(CAR_102, "HGS", 5_200, ago(20)),
    ],
  };
}

function world(name: string): World {
  const worlds = (store.__noveraMockExpenses ??= new Map());
  let found = worlds.get(name);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(name, found);
  }
  return found;
}

function view(name: string, row: Stored): FleetExpense {
  const { companyId, vehicleId, ...rest } = row;
  const car = listMockCompanyCars(name, companyId).find((c) => c.id === vehicleId);
  const spans = assignmentSpans(name, companyId).filter((g) => g.vehicleId === vehicleId);
  const person = assigneeAt(spans, row.occurredAt);
  return {
    ...rest,
    company: { id: companyId, name: getMockCompany(name, companyId)?.name ?? "—" },
    vehicle: { id: vehicleId, plate: car?.plate ?? "—", model: car ? `${car.model.brand} ${car.model.model}` : "—", contractNumber: car?.contract.number ?? "—" },
    employee: person ? { id: person.employeeId, name: person.name, department: person.department } : null,
  };
}

// The Istanbul calendar day of a moment, the way the API reads "from" and "to".
const dayOf = (iso: string): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(iso));

type Sort = { key: string; dir: "asc" | "desc" } | null;
export type ListQuery = { page: number; pageSize: number; sort: Sort; type: ExpenseType | null; status: ExpenseStatus | null; vehicle?: string | null; employee?: string | null; q?: string; company?: string | null; from?: string | null; to?: string | null };

export function listMockExpenses(name: string, query: ListQuery, companyId: string | null = null): FleetExpensePage {
  const needle = (query.q ?? "").toLowerCase().replace(/\s+/g, "");
  const views = world(name)
    .expenses.filter((row) => (companyId === null || row.companyId === companyId) && (!query.company || row.companyId === query.company))
    .filter((row) => (!query.from || dayOf(row.occurredAt) >= query.from) && (!query.to || dayOf(row.occurredAt) <= query.to))
    .filter((row) => (!query.type || row.type === query.type) && (!query.status || row.status === query.status) && (!query.vehicle || row.vehicleId === query.vehicle))
    .map((row) => view(name, row))
    .filter((row) => !needle || row.vehicle.plate.toLowerCase().replace(/\s+/g, "").includes(needle))
    .filter((row) => !query.employee || (query.employee === "none" ? row.employee === null : row.employee?.id === query.employee));
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  const by = query.sort?.key === "amount" ? "amount" : "occurredAt";
  views.sort((a, b) => sign * (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0) || a.id.localeCompare(b.id));
  return { items: views.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: views.length, page: query.page, pageSize: query.pageSize };
}

// `companyId` narrows to one company's expenses (the customer's screens): another company's is not found.
export function getMockExpense(name: string, id: string, companyId: string | null = null): FleetExpense | null {
  const row = world(name).expenses.find((entry) => entry.id === id && (companyId === null || entry.companyId === companyId));
  return row ? view(name, row) : null;
}

export type CreateOutcome = { status: "ok"; value: FleetExpense } | { status: "invalid"; fields: Record<string, string> };

export function createMockExpense(name: string, values: ExpenseFormValues): CreateOutcome {
  const plate = normalizePlate(values.plate);
  const car = plate ? [EGE].flatMap((company) => listMockCompanyCars(name, company)).find((c) => c.plate === plate) : null;
  if (!car) return { status: "invalid", fields: { plate: plate ? "UNKNOWN_REFERENCE" : "INVALID_FORMAT" } };
  if (!isMoment(values.occurredAt)) return { status: "invalid", fields: { occurredAt: "INVALID_FORMAT" } };
  const occurredAt = momentToIso(values.occurredAt);
  if (Date.parse(occurredAt) > Date.now() + 60_000) return { status: "invalid", fields: { occurredAt: "OUT_OF_RANGE" } };
  const amount = feeToKurus(values.amount);
  if (amount === null) return { status: "invalid", fields: { amount: "OUT_OF_RANGE" } };
  const now = new Date().toISOString();
  const row: Stored = {
    id: crypto.randomUUID(),
    companyId: EGE,
    vehicleId: car.id,
    type: values.type as ExpenseType,
    occurredAt,
    amount,
    description: values.description.trim() || null,
    place: values.place.trim() || null,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  };
  world(name).expenses.push(row);
  return { status: "ok", value: view(name, row) };
}

export type StatusOutcome = { status: "ok"; value: FleetExpense } | { status: "stale" | "not_found" | "not_allowed" };

export function setMockExpenseStatus(name: string, companyId: string, id: string, updatedAt: string, status: ExpenseStatus): StatusOutcome {
  const row = world(name).expenses.find((entry) => entry.id === id && entry.companyId === companyId);
  if (!row) return { status: "not_found" };
  if (row.updatedAt !== updatedAt) return { status: "stale" };
  if (row.status === status) return { status: "ok", value: view(name, row) };
  if (!canMove(row.status, status)) return { status: "not_allowed" };
  if (status === "REFLECTED" && view(name, row).employee === null) return { status: "not_allowed" };
  Object.assign(row, { status, updatedAt: nextVersion(row.updatedAt) });
  return { status: "ok", value: view(name, row) };
}

export type ReflectOutcome = { status: "ok"; reflected: number; skipped: number } | { status: "not_found" };

// An id that is not the company's refuses the whole call and changes nothing; of its own, only the open ones with a person are changed.
export function reflectMockExpenses(name: string, companyId: string, ids: string[]): ReflectOutcome {
  const rows = world(name).expenses;
  const wanted = [...new Set(ids)].map((id) => rows.find((entry) => entry.id === id && entry.companyId === companyId));
  if (wanted.some((row) => !row)) return { status: "not_found" };
  let reflected = 0;
  for (const row of wanted as Stored[]) {
    if (row.status === "OPEN" && view(name, row).employee !== null) {
      Object.assign(row, { status: "REFLECTED", updatedAt: nextVersion(row.updatedAt) });
      reflected += 1;
    }
  }
  return { status: "ok", reflected, skipped: wanted.length - reflected };
}

// What the Filom summary shows: the open expenses and what they add up to.
export function expenseSummary(name: string, companyId: string) {
  const open = world(name).expenses.filter((row) => row.companyId === companyId && row.status === "OPEN");
  return { open: { count: open.length, total: open.reduce((sum, row) => sum + row.amount, 0) } };
}

// ---------- The renewal request ----------
export type RenewalOutcome = { status: "ok"; referenceNumber: string } | { status: "already" | "not_found" };

// The request is a quote request marked as a renewal: it lands in the sample quote list of the world, where the panel finds it.
export function requestMockRenewal(name: string, companyId: string, contractNumber: string, notes: string | null): RenewalOutcome {
  const contract = getMockContract(name, contractNumber.toUpperCase());
  if (!contract || contract.company.id !== companyId) return { status: "not_found" };
  const marker = `Renewal of contract ${contract.number}`;
  const quotes = fleetOf(name).quotes;
  if (quotes.some((q) => q.source === "FLEET_RENEWAL" && q.status !== "CLOSED" && q.notes?.startsWith(marker))) return { status: "already" };
  const now = new Date().toISOString();
  const referenceNumber = `TKL-${now.slice(0, 4)}-${String(60_000 + quotes.length).padStart(5, "0")}`;
  quotes.unshift({
    id: crypto.randomUUID(),
    number: referenceNumber,
    status: "RECEIVED",
    source: "FLEET_RENEWAL",
    companyName: contract.company.name,
    contactName: "Mert Kaya",
    email: "filo@egelojistik.example",
    phone: null,
    vehicleCount: Math.max(1, contract.vehicleCount),
    durationMonths: 12,
    vehicleType: contract.productSlug,
    deliveryCities: null,
    notes: notes ? `${marker}\n${notes}` : marker,
    internalNote: null,
    productSlug: contract.productSlug,
    accountEmail: "filo@egelojistik.example",
    createdAt: now,
    updatedAt: now,
    anonymized: false,
  });
  return { status: "ok", referenceNumber };
}
