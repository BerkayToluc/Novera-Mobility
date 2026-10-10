import type { Money } from "./currency";

// Interim shapes mirroring the Prisma model (apps/api/prisma/schema.prisma); BACKLOG #12
// replaces them with the types generated from openapi.yaml. Following ARCHITECTURE ADR-17,
// translated fields carry both languages, and prices are a Money.
export type LocalizedText = { tr: string; en: string };

export type Transmission = "MANUAL" | "AUTOMATIC";
export type FuelType = "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";

export type VehicleClass = { slug: string; name: LocalizedText };

// How much the model uses per 100 km: litres for fuel cars, kWh for electric ones. The unit
// travels with the value (SPEC §2.4) so a card never shows litres for an electric car.
export type Consumption = { value: number; unit: "L_PER_100KM" | "KWH_PER_100KM" };

export type Branch = { id: string; name: string; city: string };

// One car at one branch, as the schema stores it.
export type Vehicle = {
  id: string;
  slug: string;
  // The model this car is one of; the fleet page and its dialog are keyed by it (SPEC §2.4).
  modelSlug: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  consumption: Consumption;
  dailyPrice: Money;
  // null until real photos are provided; the card draws a placeholder then.
  imageUrl: string | null;
  vehicleClass: VehicleClass;
  branchId: string;
};

// A vehicle priced for a particular search: the days it is rented and the total.
export type VehicleOffer = Vehicle & { days: number; totalPrice: Money };
