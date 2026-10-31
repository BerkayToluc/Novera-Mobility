// The routes of the live tracking simulation (V2-43, docs/FLEET.md §3.1, ADR-30): two for each city fleets are delivered to
// (src/fleet/simulation/route-data.ts). Like the rest of the seed it only ADDS what is missing and never overwrites what is there
// (QUALITY §3.3): run again on a live database it makes no copy.
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { TRACKING_ROUTES } from "../src/fleet/simulation/route-data.js";

type Db = Pick<PrismaClient, "trackingRoute">;

export type RouteSeedResult = { routes: number };

export async function seedRoutes(db: Db): Promise<RouteSeedResult> {
  const result: RouteSeedResult = { routes: 0 };
  for (const route of TRACKING_ROUTES) {
    const found = await db.trackingRoute.findUnique({ where: { city_name: { city: route.city, name: route.name } } });
    if (found) continue;
    await db.trackingRoute.create({ data: { city: route.city, name: route.name, points: route.points } });
    result.routes += 1;
  }
  return result;
}

export const ROUTE_COUNT = TRACKING_ROUTES.length;
