import "server-only";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import { ApiUnavailableError } from "./fleet-client";

type Schemas = components["schemas"];

export type AdminSummary = Schemas["AdminSummary"];

// `GET /admin/summary` (openapi tag `admin`). The session cookie travels with the call (api-request.ts); the API checks the
// role, so anything but an answer throws and the page shows its error state with a way to try again. A 401 or 403 cannot
// normally get here: the panel's layout already sent the visitor away (ADR-24).
export async function fetchAdminSummary(): Promise<AdminSummary> {
  const result = await apiRequest<AdminSummary>("GET", "/admin/summary");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/promo-codes` (V2-26): one page of the list, narrowed and sorted by the query (lib/admin-query.ts `toApiQuery`).
export async function fetchPromoCodes(query: URLSearchParams): Promise<Schemas["PromoCodePage"]> {
  const result = await apiRequest<Schemas["PromoCodePage"]>("GET", "/admin/promo-codes?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/promo-codes/{code}`: null when there is no such code (the page then does not exist), a failure to load otherwise.
export async function fetchPromoCode(code: string): Promise<Schemas["PromoCode"] | null> {
  const result = await apiRequest<Schemas["PromoCode"]>("GET", "/admin/promo-codes/" + encodeURIComponent(code));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/branches` (V2-27): one page of the list, closed branches included.
export async function fetchAdminBranches(query: URLSearchParams): Promise<Schemas["AdminBranchPage"]> {
  const result = await apiRequest<Schemas["AdminBranchPage"]>("GET", "/admin/branches?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/branches/{id}`: null when there is no such branch (the page then does not exist), a failure to load otherwise.
export async function fetchAdminBranch(id: string): Promise<Schemas["AdminBranchDetail"] | null> {
  const result = await apiRequest<Schemas["AdminBranchDetail"]>("GET", "/admin/branches/" + encodeURIComponent(id));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/vehicle-models` (V2-29): one page of the list, retired models included.
export async function fetchAdminModels(query: URLSearchParams): Promise<Schemas["AdminVehicleModelPage"]> {
  const result = await apiRequest<Schemas["AdminVehicleModelPage"]>("GET", "/admin/vehicle-models?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/vehicle-models/{slug}`: null when there is no such model (the page then does not exist), a failure to load otherwise.
export async function fetchAdminModel(slug: string): Promise<Schemas["AdminVehicleModelDetail"] | null> {
  const result = await apiRequest<Schemas["AdminVehicleModelDetail"]>("GET", "/admin/vehicle-models/" + encodeURIComponent(slug));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/vehicle-classes`: the classes a model can be put in, the options of the form.
export async function fetchModelClasses(): Promise<{ slug: string; name: { tr: string; en: string } }[]> {
  const result = await apiRequest<{ slug: string; name: { tr: string; en: string } }[]>("GET", "/admin/vehicle-classes");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}
