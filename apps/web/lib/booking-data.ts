import "server-only";
import { parseBooking, toBookingQuery, type BookingParams } from "./booking";
import type { Currency } from "./currency";
import type { Extra } from "./extra";
import { getBranches, getExtras, getVehicle } from "./fleet-client";
import { summarize, type PriceSummary } from "./price-summary";
import { rentalDays } from "./rental-search";
import type { Branch, Vehicle } from "./vehicle";

type RawParams = Record<string, string | string[] | undefined>;

export type BookingData = {
  booking: BookingParams;
  vehicle: Vehicle;
  pickup: Branch;
  dropoff: Branch;
  // Only the extras that exist; unknown slugs in the URL are dropped, so what is shown is
  // exactly what is charged.
  extras: Extra[];
  days: number;
  summary: PriceSummary;
  // The URL query that reproduces exactly this booking (used for the next page's link).
  query: ReturnType<typeof toBookingQuery>;
};

export type BookingLoad =
  | { status: "missing" }
  | { status: "error"; booking: BookingParams }
  | ({ status: "ok" } & BookingData);

// Everything the booking summary, payment and confirmation pages need, from the URL.
// "missing" is an incomplete or inconsistent link; "error" is the API being out of reach.
export async function loadBooking(params: RawParams, currency: Currency): Promise<BookingLoad> {
  const booking = parseBooking(params);
  if (!booking) return { status: "missing" };

  let vehicle: Vehicle | null;
  let allExtras: Extra[];
  let branches: Branch[];
  try {
    [vehicle, allExtras, branches] = await Promise.all([
      getVehicle(booking.vehicleSlug, currency),
      getExtras(currency),
      getBranches(),
    ]);
  } catch {
    return { status: "error", booking };
  }

  // A car belongs to one branch: a link that pairs it with another pick-up point is broken.
  const pickup = branches.find((branch) => branch.id === booking.search.pickupBranchId);
  const dropoff = branches.find((branch) => branch.id === booking.search.returnBranchId);
  if (!vehicle || vehicle.branchId !== booking.search.pickupBranchId || !pickup || !dropoff) {
    return { status: "missing" };
  }

  const days = rentalDays(booking.search);
  const extras = allExtras.filter((extra) => booking.extraSlugs.includes(extra.slug));
  const query = toBookingQuery({ ...booking, extraSlugs: extras.map((extra) => extra.slug) });
  return {
    status: "ok",
    booking,
    vehicle,
    pickup,
    dropoff,
    extras,
    days,
    summary: summarize(vehicle.dailyPrice, days, extras),
    query,
  };
}
