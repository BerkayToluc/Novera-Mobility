import { parseRentalSearch, toQuery, type RentalSearch } from "./rental-search";

// What the booking summary and payment pages receive in the URL: the search, the car (its
// slug) and the chosen extras (comma-separated slugs). The URL is typed by anyone, so
// anything incomplete means "no booking" and the page says so instead of guessing.
export type BookingParams = { search: RentalSearch; vehicleSlug: string; extraSlugs: string[] };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseBooking(params: RawParams): BookingParams | null {
  const search = parseRentalSearch(params);
  const vehicleSlug = first(params.arac);
  if (!search || !vehicleSlug) return null;
  const extraSlugs = [...new Set((first(params.ek) ?? "").split(",").filter(Boolean))];
  return { search, vehicleSlug, extraSlugs };
}

export function toBookingQuery({ search, vehicleSlug, extraSlugs }: BookingParams) {
  return {
    ...toQuery(search),
    arac: vehicleSlug,
    ...(extraSlugs.length ? { ek: extraSlugs.join(",") } : {}),
  };
}
