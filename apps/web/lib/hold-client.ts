import "server-only";
import { ApiUnavailableError } from "./fleet-client";

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

// `POST /holds` and `GET` of a hold do not exist yet (BACKLOG Y48). With USE_MOCKS=1 a hold is
// stateless: its id carries the expiry and the car (`<expiresAtMs>.<vehicleSlug>`), so nothing
// has to be stored and the flow can be walked through, including an expired hold by editing the
// address. Without it, the service is unavailable and no hold is pretended.
export async function createHold(vehicleSlug: string): Promise<Hold> {
  if (process.env.USE_MOCKS !== "1") throw new ApiUnavailableError();
  const expires = Date.now() + HOLD_MINUTES * 60_000;
  return { id: `${expires}.${vehicleSlug}`, expiresAt: new Date(expires).toISOString() };
}

// The hold with this id for this car, or null when it is unknown, belongs to another car or has
// run out. `null` is the "time is up" screen, whichever of those it was.
export async function getHold(holdId: string, vehicleSlug: string): Promise<Hold | null> {
  if (process.env.USE_MOCKS !== "1") throw new ApiUnavailableError();
  const [expires, ...rest] = holdId.split(".");
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || rest[0] !== vehicleSlug) return null;
  if (expiresAt <= Date.now()) return null;
  return { id: holdId, expiresAt: new Date(expiresAt).toISOString() };
}
