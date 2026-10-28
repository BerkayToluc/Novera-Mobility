import type { ConsumptionUnit, FuelType, Transmission } from '../generated/prisma/client.js';

// The part of a vehicle model that the model list and the search offers both show (openapi `VehicleModel`).
export type ModelRow = {
  slug: string;
  brand: string;
  model: string;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  consumption: number;
  consumptionUnit: ConsumptionUnit;
  description: unknown;
  imageUrl: string | null;
  class: { slug: string; nameTr: string; nameEn: string };
};

export function modelView(m: ModelRow) {
  return {
    slug: m.slug,
    brand: m.brand,
    model: m.model,
    class: { slug: m.class.slug, name: { tr: m.class.nameTr, en: m.class.nameEn } },
    seats: m.seats,
    bags: m.bags,
    transmission: m.transmission,
    fuelType: m.fuelType,
    consumption: { value: m.consumption, unit: m.consumptionUnit },
    description: m.description as { tr: string; en: string },
    imageUrl: m.imageUrl,
  };
}
