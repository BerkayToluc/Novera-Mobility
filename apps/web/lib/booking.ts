import { normalizePromo } from "./promo-codes";
import { parseRentalSearch, toQuery, type RentalSearch } from "./rental-search";

// What the booking summary and payment pages receive in the URL: the search, the car (its
// slug), the chosen extras (comma-separated slugs) and the hold on the car (`tutma`). The URL is
// typed by anyone, so anything incomplete means "no booking" and the page says so instead of
// guessing. `holdId` is absent on the confirmation page, where the hold is already spent.
export type BookingParams = {
  search: RentalSearch;
  vehicleSlug: string;
  extraSlugs: string[];
  holdId?: string;
  // A campaign code the visitor entered on the payment page (kod), already normalized.
  promoCode?: string;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseBooking(params: RawParams): BookingParams | null {
  const search = parseRentalSearch(params);
  const vehicleSlug = first(params.arac);
  if (!search || !vehicleSlug) return null;
  const extraSlugs = [...new Set((first(params.ek) ?? "").split(",").filter(Boolean))];
  const holdId = first(params.tutma);
  const promoCode = normalizePromo(first(params.kod));
  return { search, vehicleSlug, extraSlugs, ...(holdId ? { holdId } : {}), ...(promoCode ? { promoCode } : {}) };
}

export function toBookingQuery({ search, vehicleSlug, extraSlugs, holdId, promoCode }: BookingParams) {
  return {
    ...toQuery(search),
    arac: vehicleSlug,
    ...(extraSlugs.length ? { ek: extraSlugs.join(",") } : {}),
    ...(holdId ? { tutma: holdId } : {}),
    ...(promoCode ? { kod: promoCode } : {}),
  };
}
