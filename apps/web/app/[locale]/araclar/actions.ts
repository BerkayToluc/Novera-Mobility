"use server";

import { parseBooking, toBookingQuery } from "@/lib/booking";
import { createHold, VehicleUnavailableError } from "@/lib/hold-client";

export type StartRentalResult =
  | { ok: true; query: Record<string, string> }
  | { ok: false; reason: "taken" | "unavailable" };

// "Kirala": holds the chosen car for 15 minutes and returns the address of the booking summary,
// which carries the hold. Takes the search and the car from the results page, nothing else.
export async function startRental(params: Record<string, string>): Promise<StartRentalResult> {
  const booking = parseBooking(params);
  if (!booking) return { ok: false, reason: "unavailable" };

  try {
    const hold = await createHold(booking.vehicleSlug, booking.search);
    return { ok: true, query: toBookingQuery({ ...booking, extraSlugs: [], holdId: hold.id }) };
  } catch (error) {
    return { ok: false, reason: error instanceof VehicleUnavailableError ? "taken" : "unavailable" };
  }
}
