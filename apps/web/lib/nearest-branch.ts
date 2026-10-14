import type { BranchOption } from "./branch-options";

export type Position = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// The great-circle distance between two points in kilometres (haversine): straight over the
// ground, which is what "the nearest branch" means before any road is chosen.
export function distanceKm(a: Position, b: Position): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// The branch closest to `from`, with how far it is; null when there are no branches.
export function nearestBranch(options: BranchOption[], from: Position): { option: BranchOption; km: number } | null {
  let best: { option: BranchOption; km: number } | null = null;
  for (const option of options) {
    const km = distanceKm(from, option);
    if (!best || km < best.km) best = { option, km };
  }
  return best;
}
