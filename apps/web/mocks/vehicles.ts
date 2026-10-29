import type { AdminVehicle, AdminVehicleDetail, AdminVehiclePage, VehicleUsage } from "@/lib/admin-vehicles";
import { maxYear, MIN_YEAR, normalizePlate } from "@/lib/admin-vehicles";
import { normalizeSearch } from "@/lib/branch-detail";
import { listMockBranches } from "./branches";
import { fleetOf, nextVersion, type VehicleRecord } from "./fleet-world";
import { mockReservations } from "./reservations";

// The sample cars (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's: a new car goes to an open
// branch and a model that is on the site, and is free to rent at once; a plate is used once; a car with a booking to come cannot
// be moved or switched off, and the answer says how many; a change carries the version it was made against. The cars are the
// ones the fleet page, the search and the branches count (mocks/fleet-world.ts), so what the panel does shows on the site.
const rows = (world: string): VehicleRecord[] => fleetOf(world).vehicles;

type BranchInfo = { id: string; name: string; city: string; closed: boolean };

// Every sample branch with its name and whether it is open, for the views of a whole table at once.
function branchesOf(world: string): Map<string, BranchInfo> {
  const page = listMockBranches(world, { page: 1, pageSize: 100, sort: null, q: "", city: null, status: null });
  return new Map(page.items.map((row) => [row.id, { id: row.id, name: row.name, city: row.city, closed: row.status === "CLOSED" }]));
}

function view(record: VehicleRecord, world: string, branches: Map<string, BranchInfo> = branchesOf(world)): AdminVehicle {
  const model = fleetOf(world).models.find((entry) => entry.slug === record.modelSlug)!;
  const branch = branches.get(record.branchId) ?? { id: record.branchId, name: record.branchId, city: "", closed: false };
  return {
    id: record.id,
    plate: record.plate,
    year: record.year,
    status: record.active ? "ACTIVE" : "INACTIVE",
    model: { slug: model.slug, brand: model.brand, model: model.model, retired: model.retiredAt !== null },
    branch,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// What keeps a sample car where it is: the sample bookings still to come that pick up at its branch with its model. The sample
// bookings do not name a car, so the first car (by plate) of that model at that branch carries them.
function usageOf(world: string, record: VehicleRecord, now = Date.now()): VehicleUsage {
  const model = fleetOf(world).models.find((entry) => entry.slug === record.modelSlug)!;
  const sameKind = rows(world)
    .filter((vehicle) => vehicle.modelSlug === record.modelSlug && vehicle.branchId === record.branchId)
    .sort((a, b) => a.plate.localeCompare(b.plate));
  if (sameKind[0]?.id !== record.id) return { reservations: 0, holds: 0 };
  const reservations = mockReservations(now).filter(
    (reservation) =>
      reservation.status === "CONFIRMED" &&
      reservation.vehicle.brand === model.brand &&
      reservation.vehicle.model === model.model &&
      reservation.pickupBranchId === record.branchId &&
      Date.parse(reservation.startAt) > now,
  ).length;
  return { reservations, holds: 0 };
}

type ListQuery = {
  page: number;
  pageSize: number;
  sort: { key: string; dir: "asc" | "desc" } | null;
  q: string;
  model: string | null;
  branch: string | null;
  status: string | null;
};

export function listMockVehicles(world: string, query: ListQuery): AdminVehiclePage {
  const branches = branchesOf(world);
  const needle = normalizeSearch(query.q);
  const plateNeedle = needle.replace(/\s+/g, "");
  let items = rows(world)
    .map((record) => view(record, world, branches))
    .filter(
      (row) =>
        (!needle ||
          normalizeSearch(row.plate).replace(/\s+/g, "").includes(plateNeedle) ||
          normalizeSearch(`${row.model.brand} ${row.model.model}`).includes(needle)) &&
        (!query.model || row.model.slug === query.model) &&
        (!query.branch || row.branch.id === query.branch) &&
        (!query.status || row.status === query.status),
    );
  const sign = query.sort?.dir === "desc" ? -1 : 1;
  const by = query.sort?.key ?? "plate";
  const key = (row: AdminVehicle): number | string =>
    by === "year" ? row.year : by === "createdAt" ? row.createdAt : by === "model" ? normalizeSearch(`${row.model.brand} ${row.model.model}`) : by === "branch" ? normalizeSearch(row.branch.name) : row.plate;
  items = [...items].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || a.plate.localeCompare(b.plate));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockVehicle(world: string, id: string): AdminVehicleDetail | null {
  const found = rows(world).find((row) => row.id === id);
  return found ? { ...view(found, world), usage: usageOf(world, found) } : null;
}

export type MockOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "stale" | "not_found" | "taken" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "in_use"; usage: VehicleUsage };

export function createMockVehicle(world: string, body: { plate: string; year: number; modelSlug: string; branchId: string }): MockOutcome<AdminVehicle> {
  const plate = normalizePlate(body.plate);
  const errors: Record<string, string> = {};
  if (!plate) errors.plate = "INVALID_FORMAT";
  if (!Number.isInteger(body.year) || body.year < MIN_YEAR || body.year > maxYear()) errors.year = "OUT_OF_RANGE";
  const fleet = fleetOf(world);
  const model = fleet.models.find((entry) => entry.slug === body.modelSlug);
  if (!model || model.retiredAt) errors.modelSlug = "UNKNOWN_REFERENCE";
  const branch = branchesOf(world).get(body.branchId);
  if (!branch || branch.closed) errors.branchId = "UNKNOWN_REFERENCE";
  if (Object.keys(errors).length > 0) return { status: "invalid", fields: errors };
  if (fleet.vehicles.some((vehicle) => vehicle.plate === plate)) return { status: "taken" };

  const now = new Date().toISOString();
  const created: VehicleRecord = {
    id: "arac-" + Math.random().toString(36).slice(2, 10),
    plate: plate!,
    year: body.year,
    active: true,
    modelSlug: body.modelSlug,
    branchId: body.branchId,
    createdAt: now,
    updatedAt: now,
  };
  fleet.vehicles.push(created);
  return { status: "ok", value: view(created, world) };
}

export function updateMockVehicle(
  world: string,
  id: string,
  body: { updatedAt: string; branchId?: string; active?: boolean },
): MockOutcome<AdminVehicle> {
  const current = rows(world).find((row) => row.id === id);
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== body.updatedAt) return { status: "stale" };

  const branches = branchesOf(world);
  const moves = body.branchId !== undefined && body.branchId !== current.branchId;
  const switchesOff = body.active === false && current.active;
  const switchesOn = body.active === true && !current.active;

  if (moves || switchesOff) {
    const usage = usageOf(world, current);
    if (usage.reservations > 0 || usage.holds > 0) return { status: "in_use", usage };
  }
  const model = fleetOf(world).models.find((entry) => entry.slug === current.modelSlug)!;
  if (switchesOn && model.retiredAt) return { status: "invalid", fields: { active: "NOT_ALLOWED" } };
  const target = branches.get(body.branchId ?? current.branchId);
  if ((moves || switchesOn) && (!target || target.closed)) {
    return { status: "invalid", fields: moves ? { branchId: "UNKNOWN_REFERENCE" } : { active: "NOT_ALLOWED" } };
  }

  Object.assign(current, {
    ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
    updatedAt: nextVersion(current.updatedAt),
  });
  return { status: "ok", value: view(current, world) };
}
