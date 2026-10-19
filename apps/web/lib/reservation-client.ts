import "server-only";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import type { BookingData } from "./booking-data";
import { ApiUnavailableError } from "./fleet-client";

// The campaign code is no longer valid (openapi 422, `fieldErrors.promoCode: UNKNOWN_CODE`).
export class PromoCodeError extends Error {
  constructor() {
    super("The campaign code is no longer valid.");
    this.name = "PromoCodeError";
  }
}
import { holdApiId, VehicleUnavailableError } from "./hold-client";
import { toUtc } from "./rental-search";

type Schemas = components["schemas"];

// How a booking is shaped for `POST /reservations` (docs/api/openapi.yaml, `ReservationRequest`). The
// moments are the visitor's Istanbul wall-clock times turned into UTC; the currency is the one the
// visitor saw the total in. Extras go one each: the site has no quantity picker. Paying with points
// goes as `usePoints` (the API spends what it may). A campaign code is not in the contract, so it is not sent.
export function reservationToApi(data: BookingData): Schemas["ReservationRequest"] {
  return {
    vehicleId: data.vehicle.id,
    pickupBranchId: data.pickup.id,
    returnBranchId: data.dropoff.id,
    startAt: toUtc(data.booking.search.startAt),
    endAt: toUtc(data.booking.search.endAt),
    currency: data.summary.total.currency,
    ...(data.hold ? { holdId: holdApiId(data.hold.id) } : {}),
    ...(data.booking.usePoints && data.pointsBalance !== null ? { usePoints: true } : {}),
    // Only a code that took something off: one the visitor was told is not valid would be refused (422), and
    // one that was applied but not sent would charge the full price after showing the discounted one.
    ...(data.promo?.applied ? { promoCode: data.promo.code } : {}),
    ...(data.extras.length > 0 ? { extras: data.extras.map((extra) => ({ slug: extra.slug, quantity: 1 })) } : {}),
  };
}

// Makes the reservation (`POST /reservations`, signed in; the API sets it to CONFIRMED and writes the
// points in the same step) and returns the number the backend issued. A `409 VEHICLE_UNAVAILABLE`
// means someone else got the car first. With USE_MOCKS=1 a booking number is invented so the flow
// can be walked through and nothing is stored.
export async function createReservation(data: BookingData): Promise<{ number: string }> {
  if (process.env.USE_MOCKS === "1") {
    // Test hook, mocks only: a hold id ending in ".taken" plays a car someone else got first,
    // so the "just rented" screen can be reached without a second visitor.
    if (data.hold?.id.endsWith(".taken")) throw new VehicleUnavailableError();
    const serial = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    return { number: `NVR-${new Date().getFullYear()}-${serial}` };
  }

  const result = await apiRequest<Schemas["Reservation"]>("POST", "/reservations", reservationToApi(data));
  if (result.status === "ok") return { number: result.data.number };
  if (result.status === "conflict" && result.code === "VEHICLE_UNAVAILABLE") throw new VehicleUnavailableError();
  // A code that is unknown, closed or out of date by now: the visitor saw a discount that would not be given.
  if (result.status === "invalid" && result.fieldErrors.promoCode === "UNKNOWN_CODE") throw new PromoCodeError();
  throw new ApiUnavailableError();
}
