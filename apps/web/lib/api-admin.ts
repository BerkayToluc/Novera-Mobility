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
