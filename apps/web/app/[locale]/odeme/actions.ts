"use server";

import { loadBooking } from "@/lib/booking-data";
import { getCurrency } from "@/lib/get-currency";
import { createReservation } from "@/lib/reservation-client";
import { getSession } from "@/lib/session";

export type PlaceReservationResult =
  | { ok: true; number: string }
  | { ok: false; reason: "invalid" | "signin" | "unavailable" };

// Takes only the booking from the URL (never card details: those stay in the browser).
// The booking is loaded again here rather than trusted, so prices come from the server.
export async function placeReservation(params: Record<string, string>): Promise<PlaceReservationResult> {
  // Same rule as the payment page: with mocks on there is no auth API to sign in with.
  if (process.env.USE_MOCKS !== "1" && !(await getSession())) return { ok: false, reason: "signin" };

  const loaded = await loadBooking(params, await getCurrency());
  if (loaded.status === "missing") return { ok: false, reason: "invalid" };
  if (loaded.status === "error") return { ok: false, reason: "unavailable" };

  try {
    return { ok: true, ...(await createReservation(loaded)) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
