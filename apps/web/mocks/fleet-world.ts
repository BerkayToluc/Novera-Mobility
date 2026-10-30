import type { FuelValue } from "@/lib/admin-models";
import type { ExtraPricing } from "@/lib/extra";
import type { Transmission } from "@/lib/vehicle";
import { DESCRIPTIONS, MODELS } from "./fleet";

// The sample fleet (USE_MOCKS=1, local work and tests only, lib/mode.ts) of one "world" (lib/mock-world.ts): its models, its
// cars and its extra services. One store, so the panel, the fleet page, the search and the branches all see the same cars:
// what a branch has, what a model has, and what the search finds are counted from the same rows, the way the database does.
//
// A test that changes the fleet works in a world of its own, so the tests that count what is on the site never see its changes;
// everyone else is in "main", which is the sample data as made. It lives on `globalThis`: the pages and the actions of one
// server process share it however Next splits the modules.
export type ModelRecord = {
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
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleRecord = {
  id: string;
  plate: string;
  year: number;
  active: boolean;
  modelSlug: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtraRecord = { slug: string; name: { tr: string; en: string }; price: number; pricing: ExtraPricing; updatedAt: string };

// A sample booking cancelled from the panel (V2-31): which one, when, and why. The sample bookings themselves are fixed (mocks/reservations.ts).
export type CancellationRecord = { id: string; at: string; reason: string };

export type FleetWorld = { models: ModelRecord[]; vehicles: VehicleRecord[]; extras: ExtraRecord[]; cancellations: CancellationRecord[] };

const store = globalThis as typeof globalThis & { __noveraMockFleet?: Map<string, FleetWorld> };
// A world holds a copy of the sample data; an idle server keeps at most this many of them.
const MAX_WORLDS = 60;

// The province code of each sample branch, for the plates of its cars ("34 NV 1001", like the database's seed).
const PROVINCE: Record<string, string> = {
  istanbul: "34",
  ankara: "06",
  izmir: "35",
  antalya: "07",
  bursa: "16",
  adana: "01",
  gaziantep: "27",
  konya: "42",
  eskisehir: "26",
  kayseri: "38",
  samsun: "55",
  diyarbakir: "21",
  trabzon: "61",
};

const EXTRAS: Array<Omit<ExtraRecord, "updatedAt">> = [
  { slug: "additional-driver", name: { tr: "Ek sürücü", en: "Additional driver" }, price: 15000, pricing: "PER_DAY" },
  { slug: "child-seat", name: { tr: "Çocuk koltuğu", en: "Child seat" }, price: 10000, pricing: "PER_DAY" },
  { slug: "full-coverage", name: { tr: "Tam kapsamlı sigorta", en: "Full coverage insurance" }, price: 30000, pricing: "PER_DAY" },
  { slug: "wifi", name: { tr: "Araç içi Wi-Fi", en: "In-car Wi-Fi" }, price: 8000, pricing: "PER_DAY" },
  { slug: "hgs", name: { tr: "HGS etiketi", en: "Toll tag (HGS)" }, price: 25000, pricing: "FIXED" },
];

function seed(): FleetWorld {
  const created = new Date(Date.now() - 300 * 86_400_000).toISOString();
  const models: ModelRecord[] = MODELS.map((model) => ({
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
    retiredAt: null,
    createdAt: created,
    updatedAt: created,
  }));

  // One car for each model at each branch that stocks it.
  let sequence = 1001;
  const vehicles: VehicleRecord[] = [];
  for (const model of MODELS) {
    for (const branchId of model.branches) {
      vehicles.push({
        id: `${branchId}__${model.slug}`,
        plate: `${PROVINCE[branchId.split("-")[0]!] ?? "34"} NV ${sequence}`,
        year: 2025 + (sequence % 2),
        active: true,
        modelSlug: model.slug,
        branchId,
        createdAt: created,
        updatedAt: created,
      });
      sequence += 1;
    }
  }
  const extras: ExtraRecord[] = EXTRAS.map((extra) => ({ ...extra, updatedAt: created }));
  return { models, vehicles, extras, cancellations: [] };
}

export function fleetOf(world: string): FleetWorld {
  const worlds = (store.__noveraMockFleet ??= new Map());
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

// A tick later than the version that was read, so two quick edits never share one.
export const nextVersion = (previous: string): string => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
