import "server-only";
import type { Currency } from "./currency";
import type { Extra } from "./extra";
import { ApiUnavailableError } from "./fleet-client";
import { summarize, type PriceSummary } from "./price-summary";
import type { Vehicle } from "./vehicle";

// The price breakdown of a booking (SPEC §2.3). The page never adds prices up itself: the total
// is what `POST /reservations/price` returns (ADR-15). That endpoint is not reachable yet, so
// with USE_MOCKS=1 this stands in for it, adding the lines up on the server the way the backend
// will; without it the service is unavailable and no price is invented.
export async function quotePrice(
  vehicle: Vehicle,
  days: number,
  extras: Extra[],
  currency: Currency,
): Promise<PriceSummary> {
  void currency;
  if (process.env.USE_MOCKS !== "1") throw new ApiUnavailableError();
  return summarize(vehicle.dailyPrice, days, extras);
}
