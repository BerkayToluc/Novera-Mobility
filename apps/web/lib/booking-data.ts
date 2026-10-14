import "server-only";
import { parseBooking, toBookingQuery, type BookingParams } from "./booking";
import type { Currency } from "./currency";
import type { Extra } from "./extra";
import { getBranches, getExtras, getVehicle } from "./fleet-client";
import { getHold, type Hold } from "./hold-client";
import { quotePrice } from "./price-client";
import type { PriceSummary } from "./price-summary";
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
  // Every extra on offer, so the summary can let the visitor add or drop them.
  allExtras: Extra[];
  days: number;
  summary: PriceSummary;
  // The campaign code the visitor entered and whether it took effect; null when none was entered.
  promo: { code: string; applied: boolean } | null;
  // The hold on the car, counted down on the summary and payment pages; null when the page
  // does not need one (the confirmation, after the hold is spent).
  hold: Hold | null;
  // The URL query that reproduces exactly this booking (used for the next page's link).
  query: ReturnType<typeof toBookingQuery>;
};

export type BookingLoad =
  | { status: "missing" }
  | { status: "error"; booking: BookingParams }
  // The 15-minute hold has run out, or there never was one (SPEC §2.3).
  | { status: "expired"; booking: BookingParams }
  | ({ status: "ok" } & BookingData);

// Everything the booking summary, payment and confirmation pages need, from the URL.
// "missing" is an incomplete or inconsistent link; "error" is the API being out of reach.
// `hold: "require"` is for the pages that act on the hold (summary, payment); the confirmation
// comes after it has been spent and passes "ignore".
export async function loadBooking(
  params: RawParams,
  currency: Currency,
  options: { hold?: "require" | "ignore" } = {},
): Promise<BookingLoad> {
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

  let hold: Hold | null = null;
  if ((options.hold ?? "require") === "require") {
    if (!booking.holdId) return { status: "expired", booking };
    try {
      hold = await getHold(booking.holdId, vehicle.slug);
    } catch {
      return { status: "error", booking };
    }
    if (!hold) return { status: "expired", booking };
  }

  const days = rentalDays(booking.search);
  const extras = allExtras.filter((extra) => booking.extraSlugs.includes(extra.slug));
  const query = toBookingQuery({ ...booking, extraSlugs: extras.map((extra) => extra.slug) });
  let summary: PriceSummary;
  try {
    summary = await quotePrice(vehicle, days, extras, currency, booking.promoCode);
  } catch {
    return { status: "error", booking };
  }
  return {
    status: "ok",
    booking,
    vehicle,
    pickup,
    dropoff,
    extras,
    allExtras,
    days,
    summary,
    promo: booking.promoCode ? { code: booking.promoCode, applied: summary.discount !== null } : null,
    hold,
    query,
  };
}
