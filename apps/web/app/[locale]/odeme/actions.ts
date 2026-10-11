"use server";

import { loadBooking } from "@/lib/booking-data";
import { getCurrency } from "@/lib/get-currency";
import { VehicleUnavailableError } from "@/lib/hold-client";
import { createReservation } from "@/lib/reservation-client";
import { getSession } from "@/lib/session";

export type PlaceReservationResult =
  | { ok: true; number: string }
  // `expired`: the 15-minute hold ran out; `taken`: someone else got the car (SPEC §2.3).
  | { ok: false; reason: "invalid" | "signin" | "unavailable" | "expired" | "taken" };

// Takes only the booking from the URL (never card details: those stay in the browser).
// The booking is loaded again here rather than trusted, so prices come from the server.
export async function placeReservation(params: Record<string, string>): Promise<PlaceReservationResult> {
  // Same rule as the payment page: with mocks on there is no auth API to sign in with.
  if (process.env.USE_MOCKS !== "1" && !(await getSession())) return { ok: false, reason: "signin" };

  const loaded = await loadBooking(params, await getCurrency());
  if (loaded.status === "missing") return { ok: false, reason: "invalid" };
  if (loaded.status === "expired") return { ok: false, reason: "expired" };
  if (loaded.status === "error") return { ok: false, reason: "unavailable" };

  try {
    return { ok: true, ...(await createReservation(loaded)) };
  } catch (error) {
    if (error instanceof VehicleUnavailableError) return { ok: false, reason: "taken" };
    return { ok: false, reason: "unavailable" };
  }
}
