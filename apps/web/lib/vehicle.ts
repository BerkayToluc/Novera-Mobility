import type { Money } from "./currency";

// Interim shapes mirroring the Prisma model (apps/api/prisma/schema.prisma); BACKLOG #12
// replaces them with the types generated from openapi.yaml. Following ARCHITECTURE ADR-17,
// translated fields carry both languages, and prices are a Money.
export type LocalizedText = { tr: string; en: string };

export type Transmission = "MANUAL" | "AUTOMATIC";
export type FuelType = "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";

export type VehicleClass = { slug: string; name: LocalizedText };

export type Branch = { id: string; name: string; city: string };

// One car at one branch, as the schema stores it.
export type Vehicle = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  dailyPrice: Money;
  // null until real photos are provided; the card draws a placeholder then.
  imageUrl: string | null;
  vehicleClass: VehicleClass;
  branchId: string;
};

// A vehicle priced for a particular search: the days it is rented and the total.
export type VehicleOffer = Vehicle & { days: number; totalPrice: Money };
