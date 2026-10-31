import { chooseRoute, dayStart, isShiftSlot, istanbulDate, SLICE_MS, sliceOf, sliceStart, slotOf, trackDay, type RoutePoint } from "@/lib/simulation";
import { normalizePlate } from "@/lib/admin-vehicles";
import { addDaysToDate, ROUTE_DAYS, type RouteDay, type TrackedVehicle, type TrackingList } from "@/lib/tracking";
import { getMockContract, listMockCompanyCars } from "./admin-contracts";

// The sample live tracking (USE_MOCKS=1, local work and tests only, lib/mode.ts): the cars of the sample company on the sample routes of
// their city, worked out the way the API's are (lib/simulation.ts). The routes are the API's (apps/api/src/fleet/simulation/route-data.ts)
// for the cities the sample companies are delivered to.
const CITY_CENTERS: Record<string, RoutePoint> = {
  İzmir: { latitude: 38.4237, longitude: 27.1428 },
  Ankara: { latitude: 39.9334, longitude: 32.8597 },
  İstanbul: { latitude: 41.0082, longitude: 28.9784 },
};
const SHAPES: Array<{ suffix: string; offsets: Array<[number, number]> }> = [
  { suffix: "Merkez – Sanayi hattı", offsets: [[0, 0], [0.008, 0.015], [0.02, 0.03], [0.03, 0.055], [0.028, 0.08], [0.04, 0.1]] },
  { suffix: "Çevre yolu hattı", offsets: [[-0.03, -0.04], [0, -0.055], [0.03, -0.04], [0.045, 0], [0.03, 0.04], [0, 0.055]] },
];
export const mockRoutes = (city: string): Array<{ name: string; points: RoutePoint[] }> => {
  const center = CITY_CENTERS[city];
  if (!center) return [];
  return SHAPES.map((shape) => ({
    name: `${city} ${shape.suffix}`,
    points: shape.offsets.map(([north, east]) => ({ latitude: Math.round((center.latitude + north) * 1e5) / 1e5, longitude: Math.round((center.longitude + east) * 1e5) / 1e5 })),
  }));
};

const activeCars = (world: string, companyId: string) => listMockCompanyCars(world, companyId).filter((car) => car.status === "ACTIVE").sort((a, b) => (a.plate < b.plate ? -1 : 1));
const cityOf = (world: string, number: string): string => getMockContract(world, number)?.deliveryCity ?? "";

export function sampleTracking(world: string, companyId: string, now = Date.now()): TrackingList {
  const date = istanbulDate(now);
  const slot = slotOf(now, date);
  const items = activeCars(world, companyId).map((car): TrackedVehicle => {
    const city = cityOf(world, car.contract.number);
    const route = chooseRoute(car.id, mockRoutes(city));
    const base = { plate: car.plate, model: `${car.model.brand} ${car.model.model}`, city, employee: car.assignee ? { id: car.assignee.employeeId, name: car.assignee.name } : null };
    if (!route) return { ...base, ignition: isShiftSlot(date, slot), speedKmh: 0, position: null };
    const sample = trackDay(car.id, route.points, date)[slot]!;
    return { ...base, ignition: sample.ignition, speedKmh: sample.speedKmh, position: { latitude: sample.latitude, longitude: sample.longitude } };
  });
  return { simulated: true, updatedAt: new Date(sliceStart(sliceOf(now))).toISOString(), items };
}

// `null` for a car that does not exist, is another company's, has been given back, or whose plate cannot be one; `"out_of_range"` for a day
// the route cannot be asked for.
export function sampleRoute(world: string, companyId: string, rawPlate: string, wanted: string | undefined, now = Date.now()): RouteDay | null | "out_of_range" {
  const plate = normalizePlate(rawPlate);
  const car = plate ? activeCars(world, companyId).find((entry) => entry.plate === plate) : undefined;
  if (!car) return null;
  const today = istanbulDate(now);
  const date = wanted ?? today;
  if (date > today || date < addDaysToDate(today, -(ROUTE_DAYS - 1))) return "out_of_range";
  const city = cityOf(world, car.contract.number);
  const route = chooseRoute(car.id, mockRoutes(city));
  if (!route) return { simulated: true, vehicle: { plate: car.plate, city, route: null }, date, points: [] };
  const midnight = dayStart(date);
  const last = date === today ? slotOf(now, date) : 287;
  const points = trackDay(car.id, route.points, date)
    .slice(0, last + 1)
    .map((sample) => ({ at: new Date(midnight + sample.slot * SLICE_MS).toISOString(), latitude: sample.latitude, longitude: sample.longitude, speedKmh: sample.speedKmh, ignition: sample.ignition }));
  return { simulated: true, vehicle: { plate: car.plate, city, route: route.name }, date, points };
}
