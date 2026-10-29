import type { AdminBranch, AdminBranchDetail, AdminBranchPage, BranchUsage } from "@/lib/admin-branches";
import type { BranchDetail, DayHours } from "@/lib/branch-detail";
import { normalizeSearch } from "@/lib/branch-detail";
import type { Branch } from "@/lib/vehicle";
import { mockVehicles } from "./fleet";
import { mockReservations } from "./reservations";
import { BRANCH_SEEDS } from "./branch-seed";

// The sample branches (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's: a new branch is on
// the site at once, a closed one is not, a branch that cars or bookings still depend on refuses to close and says how many,
// and a change carries the version it was made against. The branch pages, the search form and the panel all read this one
// store, so what the panel does shows on the site.
//
// The store is kept per "world" (lib/mock-world.ts): a test that changes branches works in a world of its own, so the tests
// that count the branches on the site never see its changes. Everyone else is in "main", which is the sample data as made.
// It lives on `globalThis`: the pages and the actions of one server process share it however Next splits the modules.
type Hours = { weekdays: string; saturday: string; sunday: string };
type Record_ = Omit<AdminBranch, "status" | "activeVehicles">;
const store = globalThis as typeof globalThis & { __noveraMockBranches?: Map<string, Record_[]> };

// A world holds its branches as a copy of the sample data; an idle server keeps at most this many of them.
const MAX_WORLDS = 60;

function seed(): Record_[] {
  const created = new Date(Date.now() - 200 * 86_400_000).toISOString();
  return BRANCH_SEEDS.map((branch) => ({ ...branch, closedAt: null, createdAt: created, updatedAt: created }));
}

function rows(world: string): Record_[] {
  const worlds = (store.__noveraMockBranches ??= new Map());
  let found = worlds.get(world);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(world, found);
  }
  return found;
}

// What keeps a sample branch open: the sample cars that are there, and the sample bookings still to come.
function usageOf(id: string, now = Date.now()): BranchUsage {
  const vehicles = mockVehicles("TRY").filter((vehicle) => vehicle.branchId === id).length;
  const reservations = mockReservations(now).filter(
    (reservation) =>
      reservation.status === "CONFIRMED" &&
      ((reservation.pickupBranchId === id && Date.parse(reservation.startAt) > now) ||
        (reservation.returnBranchId === id && Date.parse(reservation.endAt) > now)),
  ).length;
  return { reservations, holds: 0, vehicles };
}

const view = (row: Record_): AdminBranch => ({ ...row, status: row.closedAt ? "CLOSED" : "OPEN", activeVehicles: usageOf(row.id).vehicles });

type ListQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string; city: string | null; status: string | null };

export function listMockBranches(world: string, query: ListQuery): AdminBranchPage {
  const needle = normalizeSearch(query.q);
  let items = rows(world)
    .map(view)
    .filter(
      (row) =>
        (!needle || normalizeSearch(`${row.name} ${row.city} ${row.address}`).includes(needle)) &&
        (!query.city || row.city === query.city) &&
        (!query.status || row.status === query.status),
    );
  const sign = query.sort?.dir === "desc" ? -1 : 1;
  const by = query.sort?.key ?? "name";
  const key = (row: AdminBranch): number | string => (by === "activeVehicles" ? row.activeVehicles : by === "createdAt" ? row.createdAt : normalizeSearch(by === "city" ? row.city : row.name));
  items = [...items].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || a.name.localeCompare(b.name, "tr"));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockBranch(world: string, id: string): AdminBranchDetail | null {
  const found = rows(world).find((row) => row.id === id);
  return found ? { ...view(found), usage: usageOf(found.id) } : null;
}

export type MockOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "stale" | "not_found" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "in_use"; usage: BranchUsage };

type Body = {
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  kind: "CITY" | "AIRPORT";
  openingHours: Hours;
};

export function createMockBranch(world: string, body: Body): MockOutcome<AdminBranch> {
  const now = new Date().toISOString();
  const created: Record_ = { ...body, id: "yeni-" + Math.random().toString(36).slice(2, 10), closedAt: null, createdAt: now, updatedAt: now };
  rows(world).push(created);
  return { status: "ok", value: view(created) };
}

// A tick later than the version that was read, so two quick edits never share one.
const nextVersion = (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();

export function updateMockBranch(world: string, id: string, body: Partial<Body> & { updatedAt: string }): MockOutcome<AdminBranch> {
  const current = rows(world).find((row) => row.id === id);
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== body.updatedAt) return { status: "stale" };
  const { updatedAt: _version, ...fields } = body;
  void _version;
  Object.assign(current, fields, { updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: view(current) };
}

export function closeMockBranch(world: string, id: string): MockOutcome<AdminBranch> {
  const current = rows(world).find((row) => row.id === id);
  if (!current) return { status: "not_found" };
  if (current.closedAt) return { status: "ok", value: view(current) };
  const usage = usageOf(id);
  if (usage.reservations > 0 || usage.holds > 0 || usage.vehicles > 0) return { status: "in_use", usage };
  Object.assign(current, { closedAt: new Date().toISOString(), updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: view(current) };
}

export function reopenMockBranch(world: string, id: string): MockOutcome<AdminBranch> {
  const current = rows(world).find((row) => row.id === id);
  if (!current) return { status: "not_found" };
  if (current.closedAt) Object.assign(current, { closedAt: null, updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: view(current) };
}

// ---------- What the site shows (closed branches are not on it) ----------
const open = (world: string): Record_[] => rows(world).filter((row) => !row.closedAt);

export const mockOpenBranches = (world: string): Branch[] => open(world).map(({ id, name, city }) => ({ id, name, city }));

const dayOf = (value: string): DayHours => {
  if (value === "closed") return null;
  const [from, to] = value.split("-");
  return from && to ? { open: from, close: to } : null;
};

export const mockBranchDetails = (world: string): BranchDetail[] =>
  open(world).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    email: row.email,
    kind: row.kind === "AIRPORT" ? "airport" : "city",
    openingHours: { weekdays: dayOf(row.openingHours.weekdays), saturday: dayOf(row.openingHours.saturday), sunday: dayOf(row.openingHours.sunday) },
  }));
