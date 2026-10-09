import "server-only";
import { mockExtras } from "@/mocks/extras";
import { mockAvailable, mockBranches, mockVehicles } from "@/mocks/fleet";
import type { Currency } from "./currency";
import type { Extra } from "./extra";
import type { RentalSearch } from "./rental-search";
import type { Branch, Vehicle, VehicleOffer } from "./vehicle";

// The branches and vehicles the pages show. The API does not exist yet (BACKLOG #6, #21),
// so without USE_MOCKS=1 every call says so instead of showing made-up cars: a production
// build must never display sample data by accident. When the API lands, only this file
// changes (it will call `${API_URL}/branches` and friends with the chosen currency).
export class ApiUnavailableError extends Error {
  constructor() {
    super("The API is not connected yet.");
    this.name = "ApiUnavailableError";
  }
}

const mocksEnabled = () => process.env.USE_MOCKS === "1";

export async function getBranches(): Promise<Branch[]> {
  if (mocksEnabled()) return mockBranches();
  throw new ApiUnavailableError();
}

export async function getVehicles(currency: Currency): Promise<Vehicle[]> {
  if (mocksEnabled()) return mockVehicles(currency);
  throw new ApiUnavailableError();
}

export async function getAvailableVehicles(
  search: RentalSearch,
  currency: Currency,
): Promise<VehicleOffer[]> {
  if (mocksEnabled()) return mockAvailable(search, currency);
  throw new ApiUnavailableError();
}

// One car by its slug (unique per car, i.e. per branch), or null when there is no such car.
export async function getVehicle(slug: string, currency: Currency): Promise<Vehicle | null> {
  if (!mocksEnabled()) throw new ApiUnavailableError();
  return mockVehicles(currency).find((vehicle) => vehicle.slug === slug) ?? null;
}

export async function getExtras(currency: Currency): Promise<Extra[]> {
  if (mocksEnabled()) return mockExtras(currency);
  throw new ApiUnavailableError();
}
