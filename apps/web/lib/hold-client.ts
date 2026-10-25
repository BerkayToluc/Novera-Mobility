import "server-only";
import { apiRequest } from "./api-request";
import { parseVehicleSlug } from "./api-mappers";
import type { components } from "./api-types";
import { ApiUnavailableError } from "./fleet-client";
import { toUtc, type RentalSearch } from "./rental-search";
import { isMockMode } from "./mode";

// The 15-minute hold on a car (SPEC §2.3, openapi `/holds`): "Kirala" holds the car, the summary
// and payment pages count down to `expiresAt`, and the booking is made against the hold.
export const HOLD_MINUTES = 15;

export type Hold = { id: string; expiresAt: string };

// The car was taken by someone else (openapi `409 VEHICLE_UNAVAILABLE`).
export class VehicleUnavailableError extends Error {
  constructor() {
    super("The vehicle is no longer available.");
    this.name = "VehicleUnavailableError";
  }
}

// The API has `POST /holds` but no call to look a hold up again, so the hold travels in the address
// with its end: `<uuid>.<expiresAtMs>`. The end is only for the countdown and the "time is up" screen;
// the API decides again when the booking is made (an expired hold re-checks that the car is free), so
// editing it gains nothing. `holdApiId` is the part the API knows.
const HOLD_ID = /^([0-9a-f-]{36})\.(\d{10,})$/i;

export const holdApiId = (holdId: string): string => HOLD_ID.exec(holdId)?.[1] ?? holdId;

// `POST /holds`. With USE_MOCKS=1 a hold is stateless: its id carries the expiry and the car
// (`<expiresAtMs>.<vehicleSlug>`), so nothing has to be stored and the flow can be walked through,
// including an expired hold by editing the address.
export async function createHold(vehicleSlug: string, search: RentalSearch): Promise<Hold> {
  if (isMockMode()) {
    const expires = Date.now() + HOLD_MINUTES * 60_000;
    return { id: `${expires}.${vehicleSlug}`, expiresAt: new Date(expires).toISOString() };
  }

  const vehicleId = parseVehicleSlug(vehicleSlug)?.vehicleId;
  if (!vehicleId) throw new ApiUnavailableError();
  const result = await apiRequest<components["schemas"]["Hold"]>("POST", "/holds", {
    vehicleId,
    pickupBranchId: search.pickupBranchId,
    returnBranchId: search.returnBranchId,
    startAt: toUtc(search.startAt),
    endAt: toUtc(search.endAt),
  });
  if (result.status === "conflict") throw new VehicleUnavailableError();
  if (result.status !== "ok") throw new ApiUnavailableError();
  return { id: `${result.data.id}.${Date.parse(result.data.expiresAt)}`, expiresAt: result.data.expiresAt };
}

// The hold with this id for this car, or null when it is unknown, belongs to another car or has
// run out. `null` is the "time is up" screen, whichever of those it was.
export async function getHold(holdId: string, vehicleSlug: string): Promise<Hold | null> {
  if (isMockMode()) {
    const [expires, ...rest] = holdId.split(".");
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt) || rest[0] !== vehicleSlug) return null;
    if (expiresAt <= Date.now()) return null;
    return { id: holdId, expiresAt: new Date(expiresAt).toISOString() };
  }

  const match = HOLD_ID.exec(holdId);
  if (!match) return null;
  const expiresAt = Number(match[2]);
  if (expiresAt <= Date.now()) return null;
  return { id: holdId, expiresAt: new Date(expiresAt).toISOString() };
}
