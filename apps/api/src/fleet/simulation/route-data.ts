import type { RoutePoint } from './tracking.js';
import { CITY_CENTERS } from './stations.js';

// The routes of the live tracking simulation (V2-43, docs/FLEET.md §3.1, ADR-30): two for every city fleets are delivered to, drawn by hand as
// polylines of a few kilometres around the centre, so no outside service is asked. A route is two lines of the same shape for every city
// (a way out to the industrial side, and a ring road) set at the city's centre; the seed writes them as `TrackingRoute` rows, and the web
// sample mode (apps/web/mocks/tracking.ts) draws the same ones.
// [north-south offset in degrees, east-west offset in degrees] from the centre of the city.
type Offsets = ReadonlyArray<readonly [number, number]>;
export const ROUTE_SHAPES: ReadonlyArray<{ suffix: string; offsets: Offsets }> = [
  { suffix: 'Merkez – Sanayi hattı', offsets: [[0, 0], [0.008, 0.015], [0.02, 0.03], [0.03, 0.055], [0.028, 0.08], [0.04, 0.1]] },
  { suffix: 'Çevre yolu hattı', offsets: [[-0.03, -0.04], [0, -0.055], [0.03, -0.04], [0.045, 0], [0.03, 0.04], [0, 0.055]] },
];

const place = (city: string, offsets: Offsets): RoutePoint[] => {
  const center = CITY_CENTERS[city]!;
  return offsets.map(([north, east]) => ({ latitude: Math.round((center.latitude + north) * 1e5) / 1e5, longitude: Math.round((center.longitude + east) * 1e5) / 1e5 }));
};

export const routeName = (city: string, suffix: string): string => `${city} ${suffix}`;

// Every route of every city: the rows the seed writes.
export const TRACKING_ROUTES: Array<{ city: string; name: string; points: RoutePoint[] }> = Object.keys(CITY_CENTERS).flatMap((city) =>
  ROUTE_SHAPES.map((shape) => ({ city, name: routeName(city, shape.suffix), points: place(city, shape.offsets) })),
);
