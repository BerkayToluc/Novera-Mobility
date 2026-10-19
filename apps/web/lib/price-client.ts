import "server-only";
import { apiRequest } from "./api-request";
import { summaryFromApi } from "./api-mappers";
import type { components } from "./api-types";
import type { Currency } from "./currency";
import type { Extra } from "./extra";
import { ApiUnavailableError } from "./fleet-client";
import { VehicleUnavailableError, holdApiId } from "./hold-client";
import { promoPercent } from "./promo-codes";
import { summarize, type PriceSummary } from "./price-summary";
import { toUtc, type RentalSearch } from "./rental-search";
import type { Vehicle } from "./vehicle";

export type PriceRequest = {
  vehicle: Vehicle;
  days: number;
  extras: Extra[];
  currency: Currency;
  search: RentalSearch;
  holdId?: string;
  promoCode?: string;
  // The points the visitor has and chose to pay with; undefined when they are not paying with points.
  pointsBalance?: number;
};

// The price breakdown of a booking (SPEC §2.3). The page never adds prices up itself: the total is
// what `POST /reservations/price` returns (ADR-15), with the points the API spent when the visitor
// pays with them. A `409` means the car is taken. With USE_MOCKS=1 the lines are added up here the way
// the backend does, with the sample campaign codes. The API takes the code off the car and the extras and says in `promo.applied` whether it did.
export async function quotePrice(request: PriceRequest): Promise<PriceSummary> {
  const { vehicle, days, extras, currency, promoCode, pointsBalance } = request;
  if (process.env.USE_MOCKS === "1") {
    // An unknown code is simply not applied: the page says so (BookingData.promo), the price is the plain one.
    const percent = promoCode ? promoPercent(promoCode) : null;
    return summarize(
      vehicle.dailyPrice,
      days,
      extras,
      promoCode && percent ? { code: promoCode, percent } : undefined,
      pointsBalance,
    );
  }

  const result = await apiRequest<components["schemas"]["PriceBreakdown"]>("POST", "/reservations/price", {
    vehicleId: vehicle.id,
    pickupBranchId: request.search.pickupBranchId,
    returnBranchId: request.search.returnBranchId,
    startAt: toUtc(request.search.startAt),
    endAt: toUtc(request.search.endAt),
    currency,
    ...(request.holdId ? { holdId: holdApiId(request.holdId) } : {}),
    ...(extras.length > 0 ? { extras: extras.map((extra) => ({ slug: extra.slug, quantity: 1 })) } : {}),
    ...(promoCode ? { promoCode } : {}),
    ...(pointsBalance !== undefined ? { usePoints: true } : {}),
  });
  if (result.status === "conflict") throw new VehicleUnavailableError();
  if (result.status !== "ok") throw new ApiUnavailableError();
  return summaryFromApi(result.data, extras);
}
