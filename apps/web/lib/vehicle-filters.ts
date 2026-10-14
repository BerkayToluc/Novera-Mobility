import type { FuelType, Transmission, VehicleOffer } from "./vehicle";

// The filters of the results page (SPEC §2.3). They live in the URL beside the search, so a
// filtered list can be shared and survives a reload; every value is checked against what is
// allowed, so a typed address can never filter by something that does not exist.
export const SORTS = ["price-asc", "price-desc", "newest"] as const;
export type Sort = (typeof SORTS)[number];

export const SEAT_STEPS = [4, 5, 7] as const;

// URL words (Turkish, like the rest of the query: alis, iade, baslangic, bitis) to the values.
const TRANSMISSIONS: Record<string, Transmission> = { manuel: "MANUAL", otomatik: "AUTOMATIC" };
const FUELS: Record<string, FuelType> = { benzin: "PETROL", dizel: "DIESEL", hibrit: "HYBRID", elektrik: "ELECTRIC" };
const SORT_WORDS: Record<string, Sort> = { artan: "price-asc", azalan: "price-desc", yeni: "newest" };

export type VehicleFilters = {
  classSlug: string | null;
  transmission: Transmission | null;
  fuel: FuelType | null;
  minSeats: number | null;
  sort: Sort;
};

export const NO_FILTERS: VehicleFilters = { classSlug: null, transmission: null, fuel: null, minSeats: null, sort: "price-asc" };

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const wordOf = <T extends string>(table: Record<string, T>, value: T | null) =>
  value ? Object.keys(table).find((word) => table[word] === value) : undefined;

export function parseVehicleFilters(params: RawParams): VehicleFilters {
  const seats = Number(first(params.koltuk));
  return {
    classSlug: first(params.sinif) || null,
    transmission: TRANSMISSIONS[first(params.vites) ?? ""] ?? null,
    fuel: FUELS[first(params.yakit) ?? ""] ?? null,
    minSeats: SEAT_STEPS.find((step) => step === seats) ?? null,
    sort: SORT_WORDS[first(params.sirala) ?? ""] ?? NO_FILTERS.sort,
  };
}

// The query words of a set of filters; a default is left out, so the plain list has a plain address.
export function toFilterQuery(filters: VehicleFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.classSlug) query.sinif = filters.classSlug;
  const transmission = wordOf(TRANSMISSIONS, filters.transmission);
  if (transmission) query.vites = transmission;
  const fuel = wordOf(FUELS, filters.fuel);
  if (fuel) query.yakit = fuel;
  if (filters.minSeats) query.koltuk = String(filters.minSeats);
  if (filters.sort !== NO_FILTERS.sort) query.sirala = wordOf(SORT_WORDS, filters.sort)!;
  return query;
}

// How many filters narrow the list; the sort order does not count.
export function activeFilterCount(filters: VehicleFilters): number {
  return [filters.classSlug, filters.transmission, filters.fuel, filters.minSeats].filter((value) => value !== null).length;
}

export function applyVehicleFilters(offers: VehicleOffer[], filters: VehicleFilters): VehicleOffer[] {
  const kept = offers.filter(
    (offer) =>
      (!filters.classSlug || offer.vehicleClass.slug === filters.classSlug) &&
      (!filters.transmission || offer.transmission === filters.transmission) &&
      (!filters.fuel || offer.fuelType === filters.fuel) &&
      (!filters.minSeats || offer.seats >= filters.minSeats),
  );
  const byPrice = (a: VehicleOffer, b: VehicleOffer) => a.dailyPrice.amount - b.dailyPrice.amount;
  // Ties keep the cheapest-first order, so a sort by year is stable and readable.
  if (filters.sort === "price-desc") return kept.sort((a, b) => byPrice(b, a));
  if (filters.sort === "newest") return kept.sort((a, b) => b.year - a.year || byPrice(a, b));
  return kept.sort(byPrice);
}
