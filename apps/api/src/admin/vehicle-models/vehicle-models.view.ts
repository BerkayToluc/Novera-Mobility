import type { ConsumptionUnit, FuelType, Transmission } from '../../generated/prisma/client.js';
import type { ModelRow } from '../../catalog/model-view.js';
import { fold } from '../admin-list.js';

// What the administrator sees of a vehicle model (V2-29, ADMIN.md §3.1): the stored fields, whether it is on the site, and how
// many cars it has.
export const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'] as const satisfies readonly FuelType[];
export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const satisfies readonly Transmission[];
export const MODEL_STATUSES = ['ACTIVE', 'RETIRED'] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

// An electric car is measured in kWh per 100 km, every other car in litres (the database keeps the same rule). So the unit is
// never asked for: it follows from the fuel.
export const consumptionUnitOf = (fuelType: FuelType): ConsumptionUnit => (fuelType === 'ELECTRIC' ? 'KWH_PER_100KM' : 'L_PER_100KM');
export const isElectric = (fuelType: FuelType): boolean => fuelType === 'ELECTRIC';

// What keeps a model on the site (the reasons a retiring is refused): bookings that start in the future with one of its cars,
// and holds that are still running on one of them.
export type ModelUsage = { reservations: number; holds: number };

type Row = ModelRow & {
  id: string;
  dailyPrice: number;
  retiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ModelView = {
  slug: string;
  brand: string;
  model: string;
  class: { slug: string; name: { tr: string; en: string } };
  fuelType: FuelType;
  transmission: Transmission;
  seats: number;
  bags: number;
  consumption: { value: number; unit: ConsumptionUnit };
  // Turkish lira in kuruş, like every price of the API (₺1.250 is 125000).
  dailyPrice: number;
  description: { tr: string; en: string };
  imageUrl: string | null;
  status: ModelStatus;
  retiredAt: string | null;
  // Cars of this model that are switched on, at any branch.
  activeVehicles: number;
  createdAt: string;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
};

export function modelAdminView(row: Row, activeVehicles: number): ModelView {
  return {
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    class: { slug: row.class.slug, name: { tr: row.class.nameTr, en: row.class.nameEn } },
    fuelType: row.fuelType,
    transmission: row.transmission,
    seats: row.seats,
    bags: row.bags,
    consumption: { value: row.consumption, unit: row.consumptionUnit },
    dailyPrice: row.dailyPrice,
    description: row.description as { tr: string; en: string },
    imageUrl: row.imageUrl,
    status: row.retiredAt ? 'RETIRED' : 'ACTIVE',
    retiredAt: row.retiredAt?.toISOString() ?? null,
    activeVehicles,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// The address of a model on the site from its name: "Renault Clio" is `renault-clio`, "Toyota Corolla Hybrid" is
// `toyota-corolla-hybrid`, "Mercedes-Benz E-Serisi" is `mercedes-benz-e-serisi`. Turkish letters become their plain ones.
export function slugOf(brand: string, model: string): string {
  return fold(`${brand} ${model}`)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
