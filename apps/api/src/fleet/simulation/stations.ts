import { seeded } from './slice.js';

export type StationStatus = 'AVAILABLE' | 'BUSY' | 'OUT_OF_ORDER';

// Whether a charging station is free, in use or out of order (ADR-30, docs/FLEET.md §3.1): from the station and the five minutes, nothing
// stored. About six in ten are free, three in ten in use, one in ten out of order, so a list of five usually has a free one and sometimes
// does not.
export function stationStatus(stationId: string, slice: number): StationStatus {
  const r = seeded(`station:${stationId}`, slice);
  return r < 0.6 ? 'AVAILABLE' : r < 0.9 ? 'BUSY' : 'OUT_OF_ORDER';
}

// Great-circle distance in kilometres (haversine), to one decimal. Enough for "the nearest stations"; a road is longer.
export function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// The centre of the cities the fleets are delivered to, where a car is taken to be while there is no live position (V2-43 will give one).
// A city that is not here has no position: its stations are then listed without a distance.
export const CITY_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  İstanbul: { latitude: 41.0082, longitude: 28.9784 },
  Ankara: { latitude: 39.9334, longitude: 32.8597 },
  İzmir: { latitude: 38.4237, longitude: 27.1428 },
  Bursa: { latitude: 40.1885, longitude: 29.061 },
  Antalya: { latitude: 36.8969, longitude: 30.7133 },
  Adana: { latitude: 37.0, longitude: 35.3213 },
  Eskişehir: { latitude: 39.7767, longitude: 30.5206 },
  Konya: { latitude: 37.8746, longitude: 32.4932 },
  Gaziantep: { latitude: 37.0662, longitude: 37.3833 },
  Kayseri: { latitude: 38.7312, longitude: 35.4787 },
  Samsun: { latitude: 41.2867, longitude: 36.33 },
  Trabzon: { latitude: 41.0027, longitude: 39.7168 },
  Diyarbakır: { latitude: 37.9144, longitude: 40.2306 },
  Mersin: { latitude: 36.8121, longitude: 34.6415 },
  Kocaeli: { latitude: 40.8533, longitude: 29.8815 },
};
