import { carbonSavedGrams, distanceKm, EMISSION_G_PER_KM, PETROL_G_PER_KM, sliceOf, sliceStart, stationStatus } from "@/lib/simulation";
import { normalizePlate } from "@/lib/admin-vehicles";
import type { GreenReport, GreenVehicle, StationList } from "@/lib/green";
import { monthsBetween, nextMonth, previousMonth } from "@/lib/report-calc";
import { getMockCarReadings, getMockContract, listMockCompanyCars } from "./admin-contracts";
import { MODELS } from "./fleet";

// The sample Green Fleet (USE_MOCKS=1, local work and tests only, lib/mode.ts): the electric and hybrid cars of the sample company with
// their readings, and a handful of made-up charging stations whose state is worked out the way the API's is (lib/simulation.ts).
const DAY = 86_400_000;
const TREND_DAYS = 183;
// Turkey has had one offset (+03:00) all year since 2016, so a month starts at midnight there.
const monthStart = (period: string): number => Date.parse(`${period}-01T00:00:00+03:00`);

export type MockStation = { id: string; name: string; city: string; latitude: number; longitude: number; sockets: string[] };
export const MOCK_STATIONS: MockStation[] = [
  { id: "d1000000-0000-4000-8000-000000000001", name: "Zeytin Şarj Alsancak", city: "İzmir", latitude: 38.4357, longitude: 27.1248, sockets: ["CCS", "TYPE2"] },
  { id: "d1000000-0000-4000-8000-000000000002", name: "Zeytin Şarj Bornova", city: "İzmir", latitude: 38.4687, longitude: 27.1928, sockets: ["CCS", "CHAdeMO", "TYPE2"] },
  { id: "d1000000-0000-4000-8000-000000000003", name: "Ege Hızlı Şarj Karşıyaka", city: "İzmir", latitude: 38.4937, longitude: 27.1128, sockets: ["CCS"] },
  { id: "d1000000-0000-4000-8000-000000000004", name: "Ege Hızlı Şarj Balçova", city: "İzmir", latitude: 38.4037, longitude: 27.0628, sockets: ["CCS", "TYPE2"] },
  { id: "d1000000-0000-4000-8000-000000000005", name: "Kordon Şarj Noktası", city: "İzmir", latitude: 38.4237, longitude: 27.1178, sockets: ["TYPE2"] },
  { id: "d1000000-0000-4000-8000-000000000006", name: "Başkent Şarj Kızılay", city: "Ankara", latitude: 39.9364, longitude: 32.8647, sockets: ["CCS", "TYPE2"] },
  { id: "d1000000-0000-4000-8000-000000000007", name: "Boğaz Şarj Beşiktaş", city: "İstanbul", latitude: 41.0382, longitude: 29.0134, sockets: ["CCS", "TYPE2"] },
];
const CITY_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  İzmir: { latitude: 38.4237, longitude: 27.1428 },
  Ankara: { latitude: 39.9334, longitude: 32.8597 },
  İstanbul: { latitude: 41.0082, longitude: 28.9784 },
};

const fuelOf = (slug: string): string | undefined => MODELS.find((model) => model.slug === slug)?.fuelType;

export function sampleGreen(world: string, companyId: string, from: string, to: string, now = Date.now()): GreenReport {
  const start = monthStart(from) - 1;
  const end = Math.min(monthStart(nextMonth(to)) - 1, now);
  const since = now - TREND_DAYS * DAY;
  const vehicles = listMockCompanyCars(world, companyId)
    .filter((car) => car.status === "ACTIVE")
    .flatMap((car): GreenVehicle[] => {
      const fuel = fuelOf(car.model.slug);
      if (fuel !== "ELECTRIC" && fuel !== "HYBRID") return [];
      const readings = [...getMockCarReadings(world, car.id)].sort((a, b) => (a.at < b.at ? -1 : 1)).filter((reading) => Date.parse(reading.at) <= now);
      const odometer = (at: number) => readings.filter((reading) => Date.parse(reading.at) <= at).at(-1)?.km ?? car.startKm;
      const charged = readings.filter((reading) => reading.chargePercent !== null);
      const health = readings.filter((reading) => reading.batteryHealthPercent !== null);
      const km = Math.max(0, odometer(end) - odometer(start));
      return [
        {
          id: car.id,
          plate: car.plate,
          model: `${car.model.brand} ${car.model.model}`,
          fuel,
          charge: charged.length > 0 ? { percent: charged.at(-1)!.chargePercent!, at: charged.at(-1)!.at } : null,
          batteryHealth: health.length > 0 ? { percent: health.at(-1)!.batteryHealthPercent!, at: health.at(-1)!.at } : null,
          batteryTrend: health.filter((reading) => Date.parse(reading.at) >= since).map((reading) => ({ at: reading.at, percent: reading.batteryHealthPercent! })),
          km,
          savedGrams: carbonSavedGrams(fuel, km),
        },
      ];
    })
    .sort((a, b) => (a.plate < b.plate ? -1 : 1));
  return {
    from,
    to,
    vehicles,
    totals: { km: vehicles.reduce((sum, v) => sum + v.km, 0), savedGrams: vehicles.reduce((sum, v) => sum + v.savedGrams, 0) },
    coefficients: { petrol: PETROL_G_PER_KM, hybrid: EMISSION_G_PER_KM.HYBRID, electric: EMISSION_G_PER_KM.ELECTRIC },
  };
}

export const defaultGreenMonths = (thisMonth: string): { from: string; to: string } => ({ from: previousMonth(thisMonth, 2), to: thisMonth });
export { monthsBetween };

// `null` for a car that does not exist, is another company's, has been given back, is not electric or hybrid, or whose plate cannot be one.
export function sampleStations(world: string, companyId: string, rawPlate: string, limit: number, now = Date.now()): StationList | null {
  const plate = normalizePlate(rawPlate);
  const car = plate ? listMockCompanyCars(world, companyId).find((entry) => entry.plate === plate && entry.status === "ACTIVE") : undefined;
  const fuel = car ? fuelOf(car.model.slug) : undefined;
  if (!car || (fuel !== "ELECTRIC" && fuel !== "HYBRID")) return null;
  const city = getMockContract(world, car.contract.number)?.deliveryCity ?? "";
  const position = CITY_CENTERS[city] ?? null;
  const slice = sliceOf(now);
  const items = MOCK_STATIONS.map((station) => ({ ...station, distanceKm: position ? distanceKm(position, station) : null, status: stationStatus(station.id, slice) }))
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, "tr");
      return Number(b.city === city) - Number(a.city === city) || a.city.localeCompare(b.city, "tr") || a.name.localeCompare(b.name, "tr");
    })
    .slice(0, limit);
  return { simulated: true, vehicle: { plate: car.plate, city, position }, updatedAt: new Date(sliceStart(slice)).toISOString(), items };
}
