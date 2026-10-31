// The simulated data of Filom in the sample mode (V2-40, ARCHITECTURE ADR-30): the same arithmetic as the API's
// (apps/api/src/fleet/simulation/), so the sample screens show what the real ones would. The real site never runs this; it reads the API.
export const SLICE_MS = 5 * 60 * 1000;

export const sliceOf = (at: number): number => Math.floor(at / SLICE_MS);
export const sliceStart = (slice: number): number => slice * SLICE_MS;

// A number in [0, 1) that depends only on the key and the slice: FNV-1a over the text, then mulberry32.
export function seeded(key: string, slice: number): number {
  let hash = 0x811c9dc5;
  for (const char of `${key}|${slice}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  let t = (hash >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type StationStatus = "AVAILABLE" | "BUSY" | "OUT_OF_ORDER";

export function stationStatus(stationId: string, slice: number): StationStatus {
  const r = seeded(`station:${stationId}`, slice);
  return r < 0.6 ? "AVAILABLE" : r < 0.9 ? "BUSY" : "OUT_OF_ORDER";
}

// Great-circle distance in kilometres, to one decimal.
export function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// Grams of CO₂ per kilometre (docs/FLEET.md §3.1) and what driving a green car saves against a petrol one.
export const PETROL_G_PER_KM = 170;
export const EMISSION_G_PER_KM = { HYBRID: 105, ELECTRIC: 45 } as const;
export const carbonSavedGrams = (fuel: keyof typeof EMISSION_G_PER_KM, km: number): number => Math.max(0, Math.round(km)) * (PETROL_G_PER_KM - EMISSION_G_PER_KM[fuel]);
