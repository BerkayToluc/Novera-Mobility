"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import {
  toCreateBody,
  toMoveBody,
  vehicleFormSchema,
  type AdminVehicle,
  type VehicleFormMessages,
  type VehicleFormValues,
  type VehicleSaveResult,
  type VehicleUsage,
} from "./admin-vehicles";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The car writes of the panel (V2-30). Each one asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The input is read
// with the same schema as the form (ADR-26); the action only names the fields that failed.
const messages = codeMessages<VehicleFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

// A car change touches the search and the fleet page. They read the API on every request, so this only drops what Next may have
// kept of the rendered pages.
function refreshSite(result: VehicleSaveResult): VehicleSaveResult {
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

const path = (id: string) => "/admin/vehicles/" + encodeURIComponent(id);

// The numbers the API gives for a refused move or switching off; a missing one is none.
const usageFrom = (details: Record<string, number> | undefined): VehicleUsage => ({
  reservations: details?.reservations ?? 0,
  holds: details?.holds ?? 0,
});

// An answer of the API, in the words the form works with.
function answer(result: ApiResult<AdminVehicle>): VehicleSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", id: result.data.id, updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "PLATE_TAKEN") return { status: "taken" };
      if (result.code === "IN_USE") return { status: "in_use", usage: usageFrom(result.details) };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// A sample-mode answer, in the same words.
type Mock =
  | { status: "ok"; value: AdminVehicle }
  | { status: "stale" | "not_found" | "taken" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "in_use"; usage: VehicleUsage };
function mockAnswer(outcome: Mock): VehicleSaveResult {
  if (outcome.status === "ok") return { status: "ok", id: outcome.value.id, updatedAt: outcome.value.updatedAt };
  return outcome;
}

const failed = (error: ZodError): VehicleSaveResult => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

export async function createVehicle(input: VehicleFormValues): Promise<VehicleSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = vehicleFormSchema(messages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);

  const body = toCreateBody(parsed.data as VehicleFormValues);
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/vehicles")).createMockVehicle(await mockWorld(), body))
      : answer(await apiRequest<AdminVehicle>("POST", "/admin/vehicles", body)),
  );
}

// `updatedAt` is the version the screen was opened at (the API answers STALE_WRITE if the car moved on since). The API refuses a
// move while a booking to come or a live hold uses the car, and says how many; the answer carries those numbers back.
export async function moveVehicle(id: string, updatedAt: string, branchId: string): Promise<VehicleSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  if (branchId.trim() === "") return { status: "invalid", fields: { branchId: "REQUIRED" } };

  const body = toMoveBody(branchId, updatedAt);
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/vehicles")).updateMockVehicle(await mockWorld(), id, body))
      : answer(await apiRequest<AdminVehicle>("PATCH", path(id), body)),
  );
}

// Switching a car off takes it out of the search; switching it on puts it back (if its model is on the site and its branch is open).
export async function setVehicleActive(id: string, updatedAt: string, active: boolean): Promise<VehicleSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const body = { updatedAt, active };
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/vehicles")).updateMockVehicle(await mockWorld(), id, body))
      : answer(await apiRequest<AdminVehicle>("PATCH", path(id), body)),
  );
}
