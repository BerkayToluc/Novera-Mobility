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

// `GET /admin/vehicles` (V2-30): one page of the list, switched-off cars included.
export async function fetchAdminVehicles(query: URLSearchParams): Promise<Schemas["AdminVehiclePage"]> {
  const result = await apiRequest<Schemas["AdminVehiclePage"]>("GET", "/admin/vehicles?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/vehicles/{id}`: null when there is no such car (the page then does not exist), a failure to load otherwise.
export async function fetchAdminVehicle(id: string): Promise<Schemas["AdminVehicleDetail"] | null> {
  const result = await apiRequest<Schemas["AdminVehicleDetail"]>("GET", "/admin/vehicles/" + encodeURIComponent(id));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/extras`: the few extra services, cheapest first.
export async function fetchAdminExtras(): Promise<Schemas["AdminExtra"][]> {
  const result = await apiRequest<Schemas["AdminExtra"][]>("GET", "/admin/extras");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/extras/{slug}`: null when there is no such extra (the page then does not exist), a failure to load otherwise.
export async function fetchAdminExtra(slug: string): Promise<Schemas["AdminExtra"] | null> {
  const result = await apiRequest<Schemas["AdminExtra"]>("GET", "/admin/extras/" + encodeURIComponent(slug));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/reservations` (V2-31): one page of the list, cancelled bookings included.
export async function fetchAdminReservations(query: URLSearchParams): Promise<Schemas["AdminReservationPage"]> {
  const result = await apiRequest<Schemas["AdminReservationPage"]>("GET", "/admin/reservations?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/reservations/{number}`: null when there is no such booking (the page then does not exist), a failure to load otherwise.
export async function fetchAdminReservation(number: string): Promise<Schemas["AdminReservationDetail"] | null> {
  const result = await apiRequest<Schemas["AdminReservationDetail"]>("GET", "/admin/reservations/" + encodeURIComponent(number));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/quotes` (V2-32): one page of the list, closed requests included.
export async function fetchAdminQuotes(query: URLSearchParams): Promise<Schemas["AdminQuotePage"]> {
  const result = await apiRequest<Schemas["AdminQuotePage"]>("GET", "/admin/quotes?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/quotes/{number}`: null when there is no such request (the page then does not exist), a failure to load otherwise.
export async function fetchAdminQuote(number: string): Promise<Schemas["AdminQuoteDetail"] | null> {
  const result = await apiRequest<Schemas["AdminQuoteDetail"]>("GET", "/admin/quotes/" + encodeURIComponent(number));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/contact-messages`: one page of the list.
export async function fetchAdminMessages(query: URLSearchParams): Promise<Schemas["AdminMessagePage"]> {
  const result = await apiRequest<Schemas["AdminMessagePage"]>("GET", "/admin/contact-messages?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/contact-messages/{id}`: null when there is no such message, a failure to load otherwise.
export async function fetchAdminMessage(id: string): Promise<Schemas["AdminMessageDetail"] | null> {
  const result = await apiRequest<Schemas["AdminMessageDetail"]>("GET", "/admin/contact-messages/" + encodeURIComponent(id));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/companies` (V2-33): one page of the list.
export async function fetchAdminCompanies(query: URLSearchParams): Promise<Schemas["AdminCompanyPage"]> {
  const result = await apiRequest<Schemas["AdminCompanyPage"]>("GET", "/admin/companies?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/companies/{id}`: null when there is no such company (the page then does not exist), a failure to load otherwise.
export async function fetchAdminCompany(id: string): Promise<Schemas["AdminCompanyDetail"] | null> {
  const result = await apiRequest<Schemas["AdminCompanyDetail"]>("GET", "/admin/companies/" + encodeURIComponent(id));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/users` (V2-34): one page of the list, closed accounts included.
export async function fetchAdminUsers(query: URLSearchParams): Promise<Schemas["AdminUserPage"]> {
  const result = await apiRequest<Schemas["AdminUserPage"]>("GET", "/admin/users?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `GET /admin/users/{id}`: null when there is no such account (the page then does not exist), a failure to load otherwise.
export async function fetchAdminUser(id: string): Promise<Schemas["AdminUserDetail"] | null> {
  const result = await apiRequest<Schemas["AdminUserDetail"]>("GET", "/admin/users/" + encodeURIComponent(id));
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

// `GET /admin/audit-log` (V2-34): one page of the log, newest first. Read only.
export async function fetchAdminAudit(query: URLSearchParams): Promise<Schemas["AdminAuditPage"]> {
  const result = await apiRequest<Schemas["AdminAuditPage"]>("GET", "/admin/audit-log?" + query.toString());
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}
