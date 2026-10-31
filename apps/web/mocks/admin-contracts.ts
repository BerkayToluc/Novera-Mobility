import type { ContractFormValues, FleetContract, FleetContractDetail, FleetReading, FleetVehicle, ReadingFormValues, VehicleFormValues } from "@/lib/admin-contracts";
import { feeToKurus } from "@/lib/admin-contracts";
import { normalizePlate } from "@/lib/admin-vehicles";
import { getMockCompany } from "./admin-companies";

// The sample contracts and fleet cars (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's: a contract
// is numbered one after the other, a plate is one car, a reading's kilometre does not go back, a car that is given back is history, a
// contract with cars still in use is not ended, and a change carries the version it was made against.
//
// Kept per "world" (lib/mock-world.ts) on `globalThis`, like the companies: a test that adds a car works in a world of its own.
type Car = {
  id: string;
  plate: string;
  modelSlug: string;
  brand: string;
  model: string;
  year: number;
  startKm: number;
  nextMaintenanceOn: string | null;
  inspectionDueOn: string | null;
  status: "ACTIVE" | "RETURNED";
  returnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readings: FleetReading[];
  assignee: FleetVehicle["assignee"];
};
type Contract = {
  id: string;
  number: string;
  companyId: string;
  productSlug: string;
  startAt: string;
  endAt: string;
  monthlyFee: number;
  deliveryCity: string;
  status: "ACTIVE" | "ENDED";
  createdAt: string;
  updatedAt: string;
  cars: Car[];
};
type World = { contracts: Contract[]; serial: number };

const store = globalThis as typeof globalThis & { __noveraMockContracts?: Map<string, World> };
const MAX_WORLDS = 60;
const DAY = 86_400_000;
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";

// The sample models a car can be (the label shows as "Brand Model"); the same slugs as the sample fleet of the site.
export const MOCK_MODEL_OPTIONS = [
  { slug: "fiat-egea", label: "Fiat Egea" },
  { slug: "renault-clio", label: "Renault Clio" },
  { slug: "toyota-corolla-hybrid", label: "Toyota Corolla Hybrid" },
  { slug: "togg-t10x", label: "Togg T10X" },
];

const dayAfter = (offset: number): string => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const iso = (offset: number): string => new Date(Date.now() + offset * DAY).toISOString();
// A slug the sample does not know is shown as its words ("honda-civic" is "Honda Civic"): the form offers the models of the site.
const labelOf = (slug: string) => MOCK_MODEL_OPTIONS.find((option) => option.slug === slug)?.label ?? slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

function seed(): World {
  const car = (n: number, plate: string, modelSlug: string, year: number, startKm: number, maintenance: number, inspection: number, readings: Array<[number, number, number | null, number | null]>, assignee: Car["assignee"] = null): Car => {
    const [brand, ...rest] = labelOf(modelSlug).split(" ");
    return {
      id: `7c000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      plate,
      modelSlug,
      brand: brand!,
      model: rest.join(" "),
      year,
      startKm,
      nextMaintenanceOn: dayAfter(maintenance),
      inspectionDueOn: dayAfter(inspection),
      status: "ACTIVE",
      returnedAt: null,
      createdAt: iso(-120),
      updatedAt: iso(-100),
      readings: readings.map(([age, km, fuel, charge], index) => ({ id: `7d000000-0000-4000-8000-${String(n * 10 + index).padStart(12, "0")}`, at: iso(-age), km, fuelPercent: fuel, chargePercent: charge, batteryHealthPercent: charge === null ? null : 98, source: "SEED" })),
      assignee,
    };
  };
  return {
    serial: 1,
    contracts: [
      {
        id: "7e000000-0000-4000-8000-000000000001",
        number: `SZL-${new Date().getUTCFullYear()}-00001`,
        companyId: EGE,
        productSlug: "akilli-kurumsal-filo",
        startAt: dayAfter(-120),
        endAt: dayAfter(245),
        monthlyFee: 6_400_000,
        deliveryCity: "İzmir",
        status: "ACTIVE",
        createdAt: iso(-120),
        updatedAt: iso(-100),
        cars: [
          car(1, "35 FLM 101", "fiat-egea", 2025, 18_400, 12, 150, [[60, 19_300, 70, null], [30, 20_100, 55, null]], { employeeId: "8b000000-0000-4000-8000-000000000001", name: "Ayşe Demir", department: "Satış", since: iso(-60) }),
          car(2, "35 FLM 102", "togg-t10x", 2025, 8_900, 40, 280, [[30, 9_800, null, 64]]),
        ],
      },
    ],
  };
}

function world(name: string): World {
  const worlds = (store.__noveraMockContracts ??= new Map());
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

const remainingDays = (c: Contract): number => (c.status === "ENDED" ? 0 : Math.max(0, Math.round((Date.parse(`${c.endAt}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / DAY)));

function carView(c: Contract, car: Car): FleetVehicle {
  const latest = [...car.readings].sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null;
  return {
    id: car.id,
    plate: car.plate,
    model: { slug: car.modelSlug, brand: car.brand, model: car.model },
    year: car.year,
    contract: { number: c.number, productSlug: c.productSlug },
    status: car.status,
    startKm: car.startKm,
    lastKm: latest?.km ?? car.startKm,
    lastReadingAt: latest?.at ?? null,
    assignee: car.assignee,
    nextMaintenanceOn: car.nextMaintenanceOn,
    inspectionDueOn: car.inspectionDueOn,
    returnedAt: car.returnedAt,
    createdAt: car.createdAt,
    updatedAt: car.updatedAt,
  };
}

function contractView(c: Contract): FleetContract {
  const company = getMockCompany("main", c.companyId);
  return {
    id: c.id,
    number: c.number,
    company: { id: c.companyId, name: company?.name ?? "—" },
    productSlug: c.productSlug,
    startAt: c.startAt,
    endAt: c.endAt,
    monthlyFee: c.monthlyFee,
    deliveryCity: c.deliveryCity,
    status: c.status,
    vehicleCount: c.cars.filter((car) => car.status === "ACTIVE").length,
    remainingDays: remainingDays(c),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export type MockOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "stale" | "not_found" | "taken" | "not_allowed" }
  | { status: "in_use"; vehicles: number }
  | { status: "invalid"; fields: Record<string, string> };

export function listMockContracts(name: string, companyId: string): FleetContract[] | null {
  if (!getMockCompany(name, companyId)) return null;
  return world(name)
    .contracts.filter((c) => c.companyId === companyId)
    .map((c) => ({ ...contractView(c), company: { id: companyId, name: getMockCompany(name, companyId)!.name } }))
    .sort((a, b) => (a.status === b.status ? (a.endAt < b.endAt ? -1 : 1) : a.status === "ACTIVE" ? -1 : 1));
}

export function getMockContract(name: string, number: string): FleetContractDetail | null {
  const found = world(name).contracts.find((c) => c.number === number.toUpperCase());
  if (!found) return null;
  const company = getMockCompany(name, found.companyId);
  return { ...contractView(found), company: { id: found.companyId, name: company?.name ?? "—" }, vehicles: found.cars.map((car) => carView(found, car)).sort((a, b) => (a.status === b.status ? (a.plate < b.plate ? -1 : 1) : a.status === "ACTIVE" ? -1 : 1)) };
}

export function createMockContract(name: string, companyId: string, values: ContractFormValues): MockOutcome<FleetContract> {
  if (!getMockCompany(name, companyId)) return { status: "not_found" };
  const w = world(name);
  w.serial += 1;
  const now = new Date().toISOString();
  const created: Contract = {
    id: crypto.randomUUID(),
    number: `SZL-${new Date().getUTCFullYear()}-${String(w.serial).padStart(5, "0")}`,
    companyId,
    productSlug: values.productSlug,
    startAt: values.startAt,
    endAt: values.endAt,
    monthlyFee: feeToKurus(values.monthlyFee) ?? 1,
    deliveryCity: values.deliveryCity,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    cars: [],
  };
  w.contracts.push(created);
  return { status: "ok", value: { ...contractView(created), company: { id: companyId, name: getMockCompany(name, companyId)!.name } } };
}

export function updateMockContract(name: string, number: string, updatedAt: string, values: ContractFormValues): MockOutcome<FleetContract> {
  const current = world(name).contracts.find((c) => c.number === number.toUpperCase());
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== updatedAt) return { status: "stale" };
  if (values.endAt <= current.startAt) return { status: "invalid", fields: { endAt: "INVALID_DATE_RANGE" } };
  const inUse = current.cars.filter((car) => car.status === "ACTIVE").length;
  if (values.status === "ENDED" && current.status === "ACTIVE" && inUse > 0) return { status: "in_use", vehicles: inUse };
  Object.assign(current, { endAt: values.endAt, monthlyFee: feeToKurus(values.monthlyFee) ?? current.monthlyFee, deliveryCity: values.deliveryCity, status: values.status, updatedAt: nextVersion(current.updatedAt) });
  return { status: "ok", value: contractView(current) };
}

export function createMockCar(name: string, number: string, values: VehicleFormValues): MockOutcome<FleetVehicle> {
  const w = world(name);
  const contract = w.contracts.find((c) => c.number === number.toUpperCase());
  if (!contract) return { status: "not_found" };
  if (contract.status !== "ACTIVE") return { status: "not_allowed" };
  const plate = normalizePlate(values.plate);
  if (!plate) return { status: "invalid", fields: { plate: "INVALID_FORMAT" } };
  if (w.contracts.some((c) => c.cars.some((car) => car.plate === plate))) return { status: "taken" };
  const [brand, ...rest] = labelOf(values.modelSlug).split(" ");
  const now = new Date().toISOString();
  const created: Car = {
    id: crypto.randomUUID(),
    plate,
    modelSlug: values.modelSlug,
    brand: brand!,
    model: rest.join(" "),
    year: Number(values.year),
    startKm: Number(values.startKm),
    nextMaintenanceOn: values.nextMaintenanceOn.trim() || null,
    inspectionDueOn: values.inspectionDueOn.trim() || null,
    status: "ACTIVE",
    returnedAt: null,
    createdAt: now,
    updatedAt: now,
    readings: [],
    assignee: null,
  };
  contract.cars.push(created);
  return { status: "ok", value: carView(contract, created) };
}

function findCar(w: World, id: string): { contract: Contract; car: Car } | null {
  for (const contract of w.contracts) {
    const car = contract.cars.find((entry) => entry.id === id);
    if (car) return { contract, car };
  }
  return null;
}

// Giving the car back: it leaves the cars in use and its assignment ends. A car that has been given back is history.
export function returnMockCar(name: string, id: string, updatedAt: string): MockOutcome<FleetVehicle> {
  const found = findCar(world(name), id);
  if (!found) return { status: "not_found" };
  if (found.car.updatedAt !== updatedAt) return { status: "stale" };
  if (found.car.status === "RETURNED") return { status: "not_allowed" };
  Object.assign(found.car, { status: "RETURNED", returnedAt: new Date().toISOString(), assignee: null, updatedAt: nextVersion(found.car.updatedAt) });
  return { status: "ok", value: carView(found.contract, found.car) };
}

export function addMockReading(name: string, id: string, values: ReadingFormValues): MockOutcome<FleetReading> {
  const found = findCar(world(name), id);
  if (!found) return { status: "not_found" };
  if (found.car.status === "RETURNED") return { status: "not_allowed" };
  const km = Number(values.km);
  const last = [...found.car.readings].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (km < (last?.km ?? found.car.startKm)) return { status: "invalid", fields: { km: "OUT_OF_RANGE" } };
  const percent = (text: string): number | null => (text.trim() === "" ? null : Number(text));
  const reading: FleetReading = { id: crypto.randomUUID(), at: new Date().toISOString(), km, fuelPercent: percent(values.fuelPercent), chargePercent: percent(values.chargePercent), batteryHealthPercent: percent(values.batteryHealthPercent), source: "MANUAL" };
  found.car.readings.push(reading);
  return { status: "ok", value: reading };
}

// ---------- What the customer's fleet screens read from the same store (mocks/fleet.ts, V2-36) ----------
// The cars of a company, with their contract number and product, the readings of a car (newest first), and the person a car is with: the
// assignment is made on the customer's screen and shows on the administrator's contract page too.
export function listMockCompanyCars(name: string, companyId: string): FleetVehicle[] {
  return world(name)
    .contracts.filter((c) => c.companyId === companyId)
    .flatMap((c) => c.cars.map((car) => carView(c, car)));
}

export function getMockCarReadings(name: string, carId: string): FleetReading[] {
  const found = findCar(world(name), carId);
  return found ? [...found.car.readings].sort((a, b) => (a.at < b.at ? 1 : -1)) : [];
}

export function setMockCarAssignee(name: string, carId: string, assignee: FleetVehicle["assignee"]): void {
  const found = findCar(world(name), carId);
  if (found) found.car.assignee = assignee;
}
