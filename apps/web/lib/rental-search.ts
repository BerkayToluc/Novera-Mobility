// What a visitor asks for on the rental form, and how it travels in the URL
// (/araclar?alis=...&iade=...&baslangic=...&bitis=...) so a results page can be shared,
// bookmarked, reloaded and edited. Times are the wall-clock time at the branch, in
// Europe/Istanbul (ARCHITECTURE ADR-16), written without an offset: "2026-10-12T10:00".

export type RentalSearch = {
  pickupBranchId: string;
  returnBranchId: string;
  startAt: string;
  endAt: string;
};

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Turkey has had no daylight saving since 2016, so the offset is fixed.
const ISTANBUL_OFFSET = "+03:00";

export function localToInstant(local: string): Date {
  return new Date(`${local}:00${ISTANBUL_OFFSET}`);
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Anything missing, malformed or backwards means "no search yet": the page then shows the
// form instead of results, never an error.
export function parseRentalSearch(params: RawParams): RentalSearch | null {
  const pickupBranchId = first(params.alis);
  const returnBranchId = first(params.iade);
  const startAt = first(params.baslangic);
  const endAt = first(params.bitis);
  if (!pickupBranchId || !returnBranchId || !startAt || !endAt) return null;
  if (!LOCAL_DATE_TIME.test(startAt) || !LOCAL_DATE_TIME.test(endAt)) return null;
  const start = localToInstant(startAt);
  const end = localToInstant(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return { pickupBranchId, returnBranchId, startAt, endAt };
}

export function toQuery(search: RentalSearch) {
  return {
    alis: search.pickupBranchId,
    iade: search.returnBranchId,
    baslangic: search.startAt,
    bitis: search.endAt,
  };
}

// Rentals are priced per started 24 hours, with a minimum of one day.
export function rentalDays(search: RentalSearch): number {
  const ms = localToInstant(search.endAt).getTime() - localToInstant(search.startAt).getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
