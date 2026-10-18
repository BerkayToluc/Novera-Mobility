import "server-only";
import { mockBranchDetails } from "@/mocks/branch-details";
import { mockExtras } from "@/mocks/extras";
import { mockAvailable, mockBranches, mockVehicles } from "@/mocks/fleet";
import { apiRequest, type ApiResult } from "./api-request";
import {
  bookedVehicle,
  branchDetailFromApi,
  extraFromApi,
  offerFromApi,
  parseVehicleSlug,
  vehiclesFromModels,
} from "./api-mappers";
import type { components } from "./api-types";
import type { BranchDetail } from "./branch-detail";
import type { Currency } from "./currency";
import type { Extra } from "./extra";
import { toUtc, type RentalSearch } from "./rental-search";
import type { Branch, Vehicle, VehicleOffer } from "./vehicle";

type Schemas = components["schemas"];

// The branches, cars and extras the pages show: `GET /branches`, `/vehicle-models`, `/vehicles` and
// `/extras` (docs/api/openapi.yaml), with the chosen currency where there are prices. With USE_MOCKS=1
// (tests and local work without an API) sample data answers instead. A failure to reach the API throws,
// and the pages show their error state: a production build never shows made-up cars.
export class ApiUnavailableError extends Error {
  constructor() {
    super("The API is not reachable.");
    this.name = "ApiUnavailableError";
  }
}

const mocksEnabled = () => process.env.USE_MOCKS === "1";

function dataOf<T>(result: ApiResult<T>): T {
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

export async function getBranches(): Promise<Branch[]> {
  if (mocksEnabled()) return mockBranches();
  return (await getBranchDetails()).map(({ id, name, city }) => ({ id, name, city }));
}

export async function getBranchDetails(): Promise<BranchDetail[]> {
  if (mocksEnabled()) return mockBranchDetails();
  return dataOf(await apiRequest<Schemas["Branch"][]>("GET", "/branches")).map(branchDetailFromApi);
}

// Every model at every branch that stocks it, for the fleet page (the models are folded again there).
export async function getVehicles(currency: Currency): Promise<Vehicle[]> {
  if (mocksEnabled()) return mockVehicles(currency);
  return vehiclesFromModels(
    dataOf(await apiRequest<Schemas["VehicleModel"][]>("GET", `/vehicle-models?currency=${currency}`)),
  );
}

// The cars free at the pick-up branch for these dates. The times go as UTC, the way the API wants them.
export async function getAvailableVehicles(search: RentalSearch, currency: Currency): Promise<VehicleOffer[]> {
  if (mocksEnabled()) return mockAvailable(search, currency);
  const query = new URLSearchParams({
    pickupBranchId: search.pickupBranchId,
    returnBranchId: search.returnBranchId,
    startAt: toUtc(search.startAt),
    endAt: toUtc(search.endAt),
    currency,
  });
  // A 422 (dates in the past, backwards) is an empty result, not a broken page.
  const result = await apiRequest<Schemas["VehicleOffer"][]>("GET", `/vehicles?${query}`);
  if (result.status === "invalid") return [];
  return dataOf(result).map(offerFromApi);
}

// One car by the slug in the address, or null when there is no such car. The slug is the model and the
// car's id; the model gives what to show, `pickupBranchId` is where the booking says the car is (the
// price and hold calls refuse a car that is not there).
export async function getVehicle(slug: string, currency: Currency, pickupBranchId: string): Promise<Vehicle | null> {
  if (mocksEnabled()) return mockVehicles(currency).find((vehicle) => vehicle.slug === slug) ?? null;
  const parsed = parseVehicleSlug(slug);
  if (!parsed) return null;
  const models = dataOf(await apiRequest<Schemas["VehicleModel"][]>("GET", `/vehicle-models?currency=${currency}`));
  const model = models.find((entry) => entry.slug === parsed.modelSlug);
  return model ? bookedVehicle(model, parsed.vehicleId, pickupBranchId, slug) : null;
}

export async function getExtras(currency: Currency): Promise<Extra[]> {
  if (mocksEnabled()) return mockExtras(currency);
  return dataOf(await apiRequest<Schemas["Extra"][]>("GET", `/extras?currency=${currency}`)).map(extraFromApi);
}
