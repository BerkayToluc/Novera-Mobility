import type { AssignFormValues, EmployeeFormValues, FleetAssignment, FleetAssignmentPage, FleetContract, FleetContractDetail, FleetContractPage, FleetEmployee, FleetEmployeePage, FleetSummary, FleetVehiclePage, FleetVehicleDetail } from "@/lib/fleet-panel";
import { normalizePlate } from "@/lib/admin-vehicles";
import { normalizeSearch } from "@/lib/branch-detail";
import { expenseSummary } from "./expenses";
import { MODELS } from "./fleet";
import { hasMockVipContract, openRequestCount } from "./requests";
import { invoiceSummary } from "./invoices";
import { getMockCarReadings, getMockContract, listMockCompanyCars, listMockContracts, setMockCarAssignee } from "./admin-contracts";

// The sample fleet of the customer (USE_MOCKS=1, local work and tests only, lib/mode.ts). The company of the sample corporate account is
// Ege Lojistik A.Ş.; its contract and cars are the ones the administrator's contract page shows (mocks/admin-contracts.ts), and the people
// and assignments are kept here. They behave like the API's: a car has at most one open assignment, a person made inactive gives the car
// back, a sicil no is one person's, and a change carries the version it was made against. Another company has nothing.
//
// Kept per "world" (lib/mock-world.ts) on `globalThis`, like the contracts: a test that gives a car away works in a world of its own.
// The models whose cars run on a battery, wholly or partly (V2-40): the Green Fleet is in the menu only when a company has one in use.
const GREEN = new Set(MODELS.filter((model) => model.fuelType === "ELECTRIC" || model.fuelType === "HYBRID").map((model) => model.slug));
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const DAY = 86_400_000;

type Person = Omit<FleetEmployee, "vehicle"> & { companyId: string };
type Given = { id: string; companyId: string; vehicleId: string; employeeId: string; startedAt: string; endedAt: string | null; note: string | null };
type World = { people: Person[]; given: Given[] };

const store = globalThis as typeof globalThis & { __noveraMockFleetPanel?: Map<string, World> };
const MAX_WORLDS = 60;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const personId = (n: number) => `8b000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CAR_101 = "7c000000-0000-4000-8000-000000000001";
const CAR_102 = "7c000000-0000-4000-8000-000000000002";

const plain = (value: string) => value.toLowerCase().replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");

function seed(): World {
  const person = (n: number, firstName: string, lastName: string, department: string, employeeNo: string, active = true): Person => ({
    id: personId(n),
    companyId: EGE,
    firstName,
    lastName,
    department,
    employeeNo,
    email: plain(`${firstName}.${lastName}@egelojistik.example`),
    phone: `+90 532 555 0${n} 1${n}`,
    active,
    createdAt: iso(-120),
    updatedAt: iso(-100),
  });
  return {
    people: [
      person(1, "Ayşe", "Demir", "Satış", "ORN-001"),
      person(2, "Burak", "Yılmaz", "Satış", "ORN-002"),
      person(3, "Cansu", "Arslan", "Operasyon", "ORN-003"),
      person(4, "Deniz", "Çelik", "Operasyon", "ORN-004"),
      person(5, "İlker", "Polat", "Depo", "ORN-005", false),
    ],
    given: [
      { id: "9a000000-0000-4000-8000-000000000001", companyId: EGE, vehicleId: CAR_101, employeeId: personId(1), startedAt: iso(-60), endedAt: null, note: "Satış ekibi aracı" },
      { id: "9a000000-0000-4000-8000-000000000002", companyId: EGE, vehicleId: CAR_102, employeeId: personId(2), startedAt: iso(-90), endedAt: iso(-35), note: null },
    ],
  };
}

function world(name: string): World {
  const worlds = (store.__noveraMockFleetPanel ??= new Map());
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

const nextVersion = (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
const pageOf = <T>(all: T[], pageNumber: number, pageSize: number) => ({ items: all.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: all.length, page: pageNumber, pageSize });
const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;
const clean = (value: string): string | null => (value.trim() === "" ? null : value.trim());

type Sort = { key: string; dir: "asc" | "desc" } | null;
function sorted<T>(rows: T[], sort: Sort, key: (row: T, by: string) => string | number, fallback: (row: T) => string): T[] {
  const sign = sort?.dir === "desc" ? -1 : 1;
  const by = sort?.key ?? "";
  return [...rows].sort((a, b) => sign * (key(a, by) < key(b, by) ? -1 : key(a, by) > key(b, by) ? 1 : 0) || fallback(a).localeCompare(fallback(b), "tr"));
}

function employeeView(world_: string, w: World, p: Person): FleetEmployee {
  const open = w.given.find((g) => g.employeeId === p.id && g.endedAt === null);
  const car = open ? listMockCompanyCars(world_, p.companyId).find((c) => c.id === open.vehicleId) : null;
  const { companyId: _company, ...rest } = p;
  void _company;
  return { ...rest, vehicle: car ? { plate: car.plate } : null };
}

function assignmentView(world_: string, w: World, g: Given): FleetAssignment {
  const car = listMockCompanyCars(world_, g.companyId).find((c) => c.id === g.vehicleId);
  const p = w.people.find((entry) => entry.id === g.employeeId)!;
  return { id: g.id, vehicle: { id: g.vehicleId, plate: car?.plate ?? "—" }, employee: { id: p.id, name: fullName(p), department: p.department }, startedAt: g.startedAt, endedAt: g.endedAt, note: g.note };
}

// The assignments of a company's cars, with the person's name, for the expenses: who had a car at a moment is worked out from these (V2-38).
export function assignmentSpans(world_: string, companyId: string): Array<{ vehicleId: string; employeeId: string; startedAt: string; endedAt: string | null; name: string; department: string | null }> {
  const w = world(world_);
  return w.given
    .filter((g) => g.companyId === companyId)
    .map((g) => {
      const p = w.people.find((entry) => entry.id === g.employeeId)!;
      return { vehicleId: g.vehicleId, employeeId: g.employeeId, startedAt: g.startedAt, endedAt: g.endedAt, name: fullName(p), department: p.department };
    });
}

// ---------- Summary, cars, contracts ----------
export function fleetSummary(world_: string, companyId: string): FleetSummary {
  const cars = listMockCompanyCars(world_, companyId).filter((c) => c.status === "ACTIVE");
  const contracts = (listMockContracts(world_, companyId) ?? []).filter((c) => c.status === "ACTIVE");
  const today = new Date().toISOString().slice(0, 10);
  const within = (day: string | null, days: number) => day !== null && (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY <= days;
  const assigned = cars.filter((c) => c.assignee !== null).length;
  return {
    date: today,
    hasActiveContract: contracts.length > 0,
    vehicles: { total: cars.length, assigned, idle: cars.length - assigned },
    contracts: { active: contracts.length, endingSoon: contracts.filter((c) => within(c.endAt, 60)).length },
    maintenanceDue: cars.filter((c) => within(c.nextMaintenanceOn, 30) || within(c.inspectionDueOn, 30)).length,
    invoices: invoiceSummary(world_, companyId),
    expenses: expenseSummary(world_, companyId),
    requests: { open: openRequestCount(world_, companyId) },
    hasVipContract: hasMockVipContract(world_, companyId),
    greenVehicles: cars.filter((c) => GREEN.has(c.model.slug)).length,
  };
}

type CarQuery = { page: number; pageSize: number; sort: Sort; q: string; status: string | null; assigned: boolean | null };

export function listFleetVehicles(world_: string, companyId: string, query: CarQuery): FleetVehiclePage {
  const words = normalizeSearch(query.q).split(/\s+/).filter(Boolean);
  const rows = listMockCompanyCars(world_, companyId).filter((c) => {
    const haystack = normalizeSearch(`${c.plate} ${c.model.brand} ${c.model.model}`).replace(/ /g, "");
    return words.every((word) => haystack.includes(word)) && (!query.status || c.status === query.status) && (query.assigned === null || (c.assignee !== null) === query.assigned);
  });
  const ordered = sorted(rows, query.sort ?? { key: "plate", dir: "asc" }, (c, by) => (by === "year" ? c.year : by === "createdAt" ? c.createdAt : c.plate), (c) => c.plate);
  return pageOf(ordered, query.page, query.pageSize);
}

export function getFleetVehicle(world_: string, companyId: string, rawPlate: string): FleetVehicleDetail | null {
  const plate = normalizePlate(rawPlate);
  const car = plate ? listMockCompanyCars(world_, companyId).find((c) => c.plate === plate) : null;
  if (!car) return null;
  const w = world(world_);
  const assignments = w.given
    .filter((g) => g.vehicleId === car.id && g.companyId === companyId)
    .map((g) => assignmentView(world_, w, g))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return { ...car, assignments, readings: getMockCarReadings(world_, car.id).slice(0, 10) };
}

export function listFleetContracts(world_: string, companyId: string, query: { page: number; pageSize: number; sort: Sort; status: string | null }): FleetContractPage {
  const rows: FleetContract[] = (listMockContracts(world_, companyId) ?? []).filter((c) => !query.status || c.status === query.status);
  const ordered = sorted(rows, query.sort ?? { key: "endAt", dir: "asc" }, (c, by) => (by === "number" ? c.number : by === "startAt" ? c.startAt : c.endAt), (c) => c.number);
  return pageOf(ordered, query.page, query.pageSize);
}

export function getFleetContract(world_: string, companyId: string, number: string): FleetContractDetail | null {
  const found = getMockContract(world_, number);
  return found && found.company.id === companyId ? found : null;
}

// ---------- People ----------
type PeopleQuery = { page: number; pageSize: number; sort: Sort; q: string; active: boolean | null };

export function listFleetEmployees(world_: string, companyId: string, query: PeopleQuery): FleetEmployeePage {
  const w = world(world_);
  const words = normalizeSearch(query.q).split(/\s+/).filter(Boolean);
  const rows = w.people
    .filter((p) => p.companyId === companyId)
    .filter((p) => {
      const haystack = normalizeSearch(`${p.firstName} ${p.lastName} ${p.department ?? ""} ${p.employeeNo ?? ""}`);
      return words.every((word) => haystack.includes(word)) && (query.active === null || p.active === query.active);
    })
    .map((p) => employeeView(world_, w, p));
  const ordered = sorted(rows, query.sort ?? { key: "lastName", dir: "asc" }, (p, by) => (by === "createdAt" ? p.createdAt : normalizeSearch(p.lastName)), (p) => p.firstName);
  return pageOf(ordered, query.page, query.pageSize);
}

export function getFleetEmployee(world_: string, companyId: string, id: string): FleetEmployee | null {
  const w = world(world_);
  const found = w.people.find((p) => p.id === id && p.companyId === companyId);
  return found ? employeeView(world_, w, found) : null;
}

export type EmployeeOutcome = { status: "ok"; value: FleetEmployee } | { status: "stale" | "not_found" | "no_taken" };

const noTaken = (w: World, companyId: string, employeeNo: string | null, exceptId?: string) =>
  employeeNo !== null && w.people.some((p) => p.companyId === companyId && p.id !== exceptId && p.employeeNo !== null && p.employeeNo.toLowerCase() === employeeNo.toLowerCase());

export function createFleetEmployee(world_: string, companyId: string, values: EmployeeFormValues): EmployeeOutcome {
  const w = world(world_);
  const employeeNo = clean(values.employeeNo);
  if (noTaken(w, companyId, employeeNo)) return { status: "no_taken" };
  const now = new Date().toISOString();
  const created: Person = {
    id: crypto.randomUUID(),
    companyId,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    department: clean(values.department),
    employeeNo,
    email: clean(values.email)?.toLowerCase() ?? null,
    phone: clean(values.phone),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  w.people.push(created);
  return { status: "ok", value: employeeView(world_, w, created) };
}

export function updateFleetEmployee(world_: string, companyId: string, id: string, updatedAt: string, values: EmployeeFormValues): EmployeeOutcome {
  const w = world(world_);
  const current = w.people.find((p) => p.id === id && p.companyId === companyId);
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== updatedAt) return { status: "stale" };
  const employeeNo = clean(values.employeeNo);
  if (noTaken(w, companyId, employeeNo, id)) return { status: "no_taken" };
  Object.assign(current, { firstName: values.firstName.trim(), lastName: values.lastName.trim(), department: clean(values.department), employeeNo, email: clean(values.email)?.toLowerCase() ?? null, phone: clean(values.phone), updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: employeeView(world_, w, current) };
}

// A person who leaves gives the car back at once (FLEET.md §3): the assignment they have ends, and the car is free.
export function setFleetEmployeeActive(world_: string, companyId: string, id: string, updatedAt: string, active: boolean): EmployeeOutcome {
  const w = world(world_);
  const current = w.people.find((p) => p.id === id && p.companyId === companyId);
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== updatedAt) return { status: "stale" };
  if (!active && current.active) {
    for (const g of w.given.filter((entry) => entry.employeeId === id && entry.endedAt === null)) {
      g.endedAt = new Date().toISOString();
      setMockCarAssignee(world_, g.vehicleId, null);
    }
  }
  Object.assign(current, { active, updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: employeeView(world_, w, current) };
}

// ---------- Assignments ----------
type GivenQuery = { page: number; pageSize: number; vehicle: string | null; employee: string | null; open: boolean | null };

export function listFleetAssignments(world_: string, companyId: string, query: GivenQuery): FleetAssignmentPage {
  const w = world(world_);
  const rows = w.given
    .filter((g) => g.companyId === companyId && (!query.vehicle || g.vehicleId === query.vehicle) && (!query.employee || g.employeeId === query.employee) && (query.open === null || (g.endedAt === null) === query.open))
    .map((g) => assignmentView(world_, w, g))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return pageOf(rows, query.page, query.pageSize);
}

export type AssignOutcome = { status: "ok" } | { status: "assigned" | "not_allowed" } | { status: "invalid"; fields: Record<string, string> };

export function assignFleetVehicle(world_: string, companyId: string, vehicleId: string, values: AssignFormValues): AssignOutcome {
  const w = world(world_);
  const car = listMockCompanyCars(world_, companyId).find((c) => c.id === vehicleId);
  if (!car) return { status: "invalid", fields: { fleetVehicleId: "UNKNOWN_REFERENCE" } };
  const person = w.people.find((p) => p.id === values.employeeId && p.companyId === companyId);
  if (!person) return { status: "invalid", fields: { employeeId: "UNKNOWN_REFERENCE" } };
  if (!person.active) return { status: "invalid", fields: { employeeId: "NOT_ALLOWED" } };
  if (car.status !== "ACTIVE") return { status: "not_allowed" };
  if (w.given.some((g) => g.vehicleId === vehicleId && g.endedAt === null)) return { status: "assigned" };
  const startedAt = values.startedAt.trim() ? new Date(`${values.startedAt.trim()}T00:00:00+03:00`).toISOString() : new Date().toISOString();
  if (Date.parse(startedAt) > Date.now() + 60_000) return { status: "invalid", fields: { startedAt: "OUT_OF_RANGE" } };
  const last = w.given.filter((g) => g.vehicleId === vehicleId && g.endedAt !== null).sort((a, b) => (a.endedAt! < b.endedAt! ? 1 : -1))[0];
  if (last && startedAt < last.endedAt!) return { status: "invalid", fields: { startedAt: "OUT_OF_RANGE" } };
  w.given.push({ id: crypto.randomUUID(), companyId, vehicleId, employeeId: person.id, startedAt, endedAt: null, note: clean(values.note) });
  setMockCarAssignee(world_, vehicleId, { employeeId: person.id, name: fullName(person), department: person.department, since: startedAt });
  return { status: "ok" };
}

export function endFleetAssignment(world_: string, companyId: string, id: string): { status: "ok" | "not_found" | "not_allowed" } {
  const w = world(world_);
  const found = w.given.find((g) => g.id === id && g.companyId === companyId);
  if (!found) return { status: "not_found" };
  if (found.endedAt) return { status: "not_allowed" };
  found.endedAt = new Date().toISOString();
  setMockCarAssignee(world_, found.vehicleId, null);
  return { status: "ok" };
}
