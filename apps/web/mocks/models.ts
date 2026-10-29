import type { AdminModel, AdminModelDetail, AdminModelPage, FuelValue, ModelClass, ModelUsage } from "@/lib/admin-models";
import { consumptionUnitOf, isElectric, suggestSlug, SLUG } from "@/lib/admin-models";
import { normalizeSearch } from "@/lib/branch-detail";
import type { Currency } from "@/lib/currency";
import { rentalDays, type RentalSearch } from "@/lib/rental-search";
import type { Transmission, Vehicle, VehicleOffer } from "@/lib/vehicle";
import { CLASSES, DESCRIPTIONS, inCurrency, MODELS } from "./fleet";
import { mockReservations } from "./reservations";

// The sample vehicle models (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's: a new model is on
// the fleet page at once (with no cars, so it is not in the search), a retired one is not on the site, a model with a booking to
// come refuses to be retired and says how many, and a change carries the version it was made against. The fleet section, the
// search and the panel all read this one store, so what the panel does shows on the site.
//
// Kept per "world" (lib/mock-world.ts), like the branches: a test that changes models works in a world of its own, so the tests
// that count the models on the site never see its changes. It lives on `globalThis`: the pages and the actions of one server
// process share it however Next splits the modules.
type Record_ = {
  slug: string;
  brand: string;
  model: string;
  classSlug: string;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelValue;
  consumption: number;
  dailyPrice: number;
  description: { tr: string; en: string };
  imageUrl: string | null;
  // The branches that stock it (the sample cars). A model made in the panel has none until cars are added (V2-30).
  branches: string[];
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const store = globalThis as typeof globalThis & { __noveraMockModels?: Map<string, Record_[]> };
const MAX_WORLDS = 60;

function seed(): Record_[] {
  const created = new Date(Date.now() - 300 * 86_400_000).toISOString();
  return MODELS.map((model) => ({
    slug: model.slug,
    brand: model.brand,
    model: model.model,
    classSlug: model.class,
    seats: model.seats,
    bags: model.bags,
    transmission: model.transmission,
    fuelType: model.fuelType,
    consumption: model.consumption.value,
    dailyPrice: model.dailyKurus,
    description: DESCRIPTIONS[model.slug]!,
    imageUrl: `/fleet/${model.slug}.webp`,
    branches: model.branches,
    retiredAt: null,
    createdAt: created,
    updatedAt: created,
  }));
}

function rows(world: string): Record_[] {
  const worlds = (store.__noveraMockModels ??= new Map());
  let found = worlds.get(world);
  if (!found) {
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(world, found);
  }
  return found;
}

// ---------- What the site shows ----------
// One car per model and branch, the way the fleet page reads the API. A model that no branch stocks (the ones made in the panel
// before cars are added) is one car at no branch, so the fleet page still has a card for it.
function carsOf(world: string): Vehicle[] {
  const cars: Vehicle[] = [];
  for (const record of rows(world)) {
    if (record.retiredAt) continue;
    const base = {
      modelSlug: record.slug,
      brand: record.brand,
      model: record.model,
      seats: record.seats,
      bags: record.bags,
      transmission: record.transmission,
      fuelType: record.fuelType,
      consumption: { value: record.consumption, unit: consumptionUnitOf(record.fuelType) },
      description: record.description,
      dailyPrice: { amount: record.dailyPrice, currency: "TRY" as const },
      imageUrl: record.imageUrl,
      vehicleClass: CLASSES[record.classSlug]!,
    };
    if (record.branches.length === 0) {
      cars.push({ ...base, id: `${record.slug}__none`, slug: `${record.slug}-none`, branchId: "" });
      continue;
    }
    for (const branchId of record.branches) {
      cars.push({ ...base, year: 2025, id: `${branchId}__${record.slug}`, slug: `${record.slug}-${branchId}`, branchId });
    }
  }
  return cars;
}

export function mockVehicles(world: string, currency: Currency): Vehicle[] {
  return carsOf(world).map((vehicle) => inCurrency(vehicle, currency));
}

// The cars at the pick-up branch. A rental longer than 30 days finds nothing, so the empty state can be reached without a branch
// that has no cars. The start is not checked against the clock: the tests search fixed dates, and a date that has passed would
// turn them all into empty results.
export function mockAvailable(world: string, search: RentalSearch, currency: Currency): VehicleOffer[] {
  const days = rentalDays(search);
  if (days > 30) return [];
  return carsOf(world)
    .filter((vehicle) => vehicle.branchId === search.pickupBranchId)
    .map((vehicle) => {
      const priced = inCurrency(vehicle, currency);
      return { ...priced, days, totalPrice: { amount: priced.dailyPrice.amount * days, currency } };
    });
}

// How many sample cars a branch has (the branches' own closing rule reads it).
export const carsAtBranch = (world: string, branchId: string): number => carsOf(world).filter((vehicle) => vehicle.branchId === branchId).length;

// ---------- What the panel shows ----------
export const mockClasses = (): ModelClass[] => Object.values(CLASSES).map((entry) => ({ slug: entry.slug, name: entry.name }));

const view = (record: Record_): AdminModel => {
  const entry = CLASSES[record.classSlug]!;
  return {
    slug: record.slug,
    brand: record.brand,
    model: record.model,
    class: { slug: entry.slug, name: entry.name },
    fuelType: record.fuelType,
    transmission: record.transmission,
    seats: record.seats,
    bags: record.bags,
    consumption: { value: record.consumption, unit: consumptionUnitOf(record.fuelType) },
    dailyPrice: record.dailyPrice,
    description: record.description,
    imageUrl: record.imageUrl,
    status: record.retiredAt ? "RETIRED" : "ACTIVE",
    retiredAt: record.retiredAt,
    activeVehicles: record.retiredAt ? 0 : record.branches.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

// What keeps a sample model on the site: the sample bookings still to come with a car of it.
function usageOf(record: Record_, now = Date.now()): ModelUsage {
  const reservations = mockReservations(now).filter(
    (reservation) =>
      reservation.status === "CONFIRMED" &&
      reservation.vehicle.brand === record.brand &&
      reservation.vehicle.model === record.model &&
      Date.parse(reservation.startAt) > now,
  ).length;
  return { reservations, holds: 0 };
}

type ListQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string; classSlug: string | null; fuel: string | null; status: string | null };

export function listMockModels(world: string, query: ListQuery): AdminModelPage {
  const needle = normalizeSearch(query.q);
  let items = rows(world)
    .map(view)
    .filter(
      (row) =>
        (!needle || normalizeSearch(`${row.brand} ${row.model} ${row.slug}`).includes(needle)) &&
        (!query.classSlug || row.class.slug === query.classSlug) &&
        (!query.fuel || row.fuelType === query.fuel) &&
        (!query.status || row.status === query.status),
    );
  const sign = query.sort?.dir === "desc" ? -1 : 1;
  const by = query.sort?.key ?? "name";
  const key = (row: AdminModel): number | string =>
    by === "dailyPrice" ? row.dailyPrice : by === "activeVehicles" ? row.activeVehicles : by === "createdAt" ? row.createdAt : normalizeSearch(`${row.brand} ${row.model}`);
  items = [...items].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || a.slug.localeCompare(b.slug));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockModel(world: string, slug: string): AdminModelDetail | null {
  const found = rows(world).find((row) => row.slug === slug.toLowerCase());
  return found ? { ...view(found), usage: usageOf(found) } : null;
}

export type MockOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "stale" | "not_found" | "taken" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "in_use"; usage: ModelUsage };

type Body = {
  brand: string;
  model: string;
  slug?: string;
  classSlug: string;
  fuelType: FuelValue;
  transmission: Transmission;
  seats: number;
  bags: number;
  consumption: number;
  dailyPrice: number;
  description: { tr: string; en: string };
  imageUrl?: string | null;
};

export function createMockModel(world: string, body: Body): MockOutcome<AdminModel> {
  if (!CLASSES[body.classSlug]) return { status: "invalid", fields: { classSlug: "UNKNOWN_REFERENCE" } };
  const slug = body.slug ?? suggestSlug(body.brand, body.model);
  if (slug.length < 3 || !SLUG.test(slug)) return { status: "invalid", fields: { slug: "INVALID_FORMAT" } };
  if (rows(world).some((row) => row.slug === slug)) return { status: "taken" };
  const now = new Date().toISOString();
  const created: Record_ = {
    slug,
    brand: body.brand,
    model: body.model,
    classSlug: body.classSlug,
    seats: body.seats,
    bags: body.bags,
    transmission: body.transmission,
    fuelType: body.fuelType,
    consumption: Math.round(body.consumption * 10) / 10,
    dailyPrice: body.dailyPrice,
    description: body.description,
    imageUrl: body.imageUrl ?? null,
    branches: [],
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  };
  rows(world).push(created);
  return { status: "ok", value: view(created) };
}

// A tick later than the version that was read, so two quick edits never share one.
const nextVersion = (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();

export function updateMockModel(world: string, slug: string, body: Partial<Body> & { updatedAt: string }): MockOutcome<AdminModel> {
  const current = rows(world).find((row) => row.slug === slug.toLowerCase());
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== body.updatedAt) return { status: "stale" };
  if (body.classSlug !== undefined && !CLASSES[body.classSlug]) return { status: "invalid", fields: { classSlug: "UNKNOWN_REFERENCE" } };
  if (body.fuelType !== undefined && isElectric(body.fuelType) !== isElectric(current.fuelType) && body.consumption === undefined) {
    return { status: "invalid", fields: { consumption: "REQUIRED" } };
  }
  const { updatedAt: _version, slug: _slug, ...fields } = body;
  void _version;
  void _slug;
  Object.assign(current, fields, {
    ...(fields.consumption !== undefined ? { consumption: Math.round(fields.consumption * 10) / 10 } : {}),
    ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl } : {}),
    updatedAt: nextVersion(current.updatedAt),
  });
  return { status: "ok", value: view(current) };
}

export function retireMockModel(world: string, slug: string): MockOutcome<AdminModel> {
  const current = rows(world).find((row) => row.slug === slug.toLowerCase());
  if (!current) return { status: "not_found" };
  if (current.retiredAt) return { status: "ok", value: view(current) };
  const usage = usageOf(current);
  if (usage.reservations > 0 || usage.holds > 0) return { status: "in_use", usage };
  // The cars go off with the model; putting the model back does not bring them back (V2-30 does that, car by car).
  Object.assign(current, { retiredAt: new Date().toISOString(), branches: [], updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: view(current) };
}

export function restoreMockModel(world: string, slug: string): MockOutcome<AdminModel> {
  const current = rows(world).find((row) => row.slug === slug.toLowerCase());
  if (!current) return { status: "not_found" };
  if (current.retiredAt) Object.assign(current, { retiredAt: null, updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: view(current) };
}
