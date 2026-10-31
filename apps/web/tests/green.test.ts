import { describe, expect, it } from "vitest";
import { kilograms, lineGeometry, pickVehicle, stationTone, type GreenVehicle } from "@/lib/green";
import { carbonSavedGrams, distanceKm, EMISSION_G_PER_KM, PETROL_G_PER_KM, seeded, sliceOf, sliceStart, stationStatus } from "@/lib/simulation";
import { listMockCompanyCars, returnMockCar } from "@/mocks/admin-contracts";
import { fleetSummary } from "@/mocks/fleet-panel";
import { MOCK_STATIONS, sampleGreen, sampleStations } from "@/mocks/green";
import { en, tr } from "../i18n/messages";
import { routing } from "../i18n/routing";
import { FLEET_SCREENS } from "../lib/fleet-screens";

// The Green Fleet screen's rules (V2-40) without a browser: the simulation (the same arithmetic as the API's), the carbon, the sample
// stations and cars, and the line chart's geometry. The same rules against the real API and the database are in
// apps/api/src/fleet/fleet-green.integration.spec.ts.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const OTHER = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
const TOGG = "7c000000-0000-4000-8000-000000000002";
let counter = 0;
const world = () => `green-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;
const NOW = Date.parse("2026-10-31T10:07:00.000Z");

describe("the simulation is the API's (ADR-30)", () => {
  it("gives the very numbers the API gives for the same key and slice (pinned from apps/api/src/fleet/simulation)", () => {
    expect(seeded("station:abc", 7)).toBe(0.7176246182061732);
    expect(seeded("station:xyz", 123456)).toBe(0.5076978460419923);
    expect(stationStatus("c0ffee", 5_700_000)).toBe("AVAILABLE");
    expect(stationStatus("1234", 5_700_001)).toBe("BUSY");
  });

  it("cuts time into five-minute slices, and the same slice gives the same state however often it is asked", () => {
    expect(new Date(sliceStart(sliceOf(Date.parse("2026-10-31T10:07:00Z")))).toISOString()).toBe("2026-10-31T10:05:00.000Z");
    expect(sliceOf(Date.parse("2026-10-31T10:09:59Z"))).toBe(sliceOf(Date.parse("2026-10-31T10:05:00Z")));
    expect(sliceOf(Date.parse("2026-10-31T10:10:00Z"))).toBe(sliceOf(Date.parse("2026-10-31T10:05:00Z")) + 1);
    for (let call = 0; call < 5; call += 1) expect(stationStatus("s", 99)).toBe(stationStatus("s", 99));
  });

  it("the distance is the great-circle distance to a decimal", () => {
    expect(distanceKm({ latitude: 39.9334, longitude: 32.8597 }, { latitude: 39.9334, longitude: 32.8597 })).toBe(0);
    const ankaraToIstanbul = distanceKm({ latitude: 39.9334, longitude: 32.8597 }, { latitude: 41.0082, longitude: 28.9784 });
    expect(ankaraToIstanbul).toBeGreaterThan(340);
    expect(ankaraToIstanbul).toBeLessThan(360);
  });
});

describe("the carbon", () => {
  it("uses the factors of the document and is the kilometres times what a petrol car gives off less what this one does", () => {
    expect([PETROL_G_PER_KM, EMISSION_G_PER_KM.HYBRID, EMISSION_G_PER_KM.ELECTRIC]).toEqual([170, 105, 45]);
    expect(carbonSavedGrams("ELECTRIC", 1_000)).toBe(125_000);
    expect(carbonSavedGrams("HYBRID", 1_000)).toBe(65_000);
    expect(carbonSavedGrams("ELECTRIC", -3)).toBe(0);
  });

  it("is written in kilograms to one decimal in the reader's language", () => {
    expect(kilograms(125_000, "tr")).toBe("125");
    expect(kilograms(12_550, "tr")).toBe("12,6");
    expect(kilograms(12_550, "en")).toBe("12.6");
  });
});

describe("the sample Green Fleet", () => {
  it("has the electric car of the sample company, and only that: the petrol car and another company's are not in it", () => {
    const report = sampleGreen(world(), EGE, "2026-08", "2026-10", NOW);
    expect(report.vehicles.map((v) => v.plate)).toEqual(["35 FLM 102"]);
    expect(report.vehicles[0]).toMatchObject({ fuel: "ELECTRIC", charge: { percent: 64 } });
    expect(sampleGreen(world(), OTHER, "2026-08", "2026-10", NOW).vehicles).toEqual([]);
  });

  it("the carbon of a car is its kilometres times the factor, and the totals are the sums", () => {
    const report = sampleGreen(world(), EGE, "2000-01", "2100-01", Date.now());
    const car = report.vehicles[0]!;
    expect(car.km).toBeGreaterThan(0);
    expect(car.savedGrams).toBe(car.km * 125);
    expect(report.totals).toEqual({ km: car.km, savedGrams: car.savedGrams });
  });

  it("the summary counts the green cars, and a car that is given back leaves the screen and the menu", () => {
    const name = world();
    expect(fleetSummary(name, EGE).greenVehicles).toBe(1);
    const version = listMockCompanyCars(name, EGE).find((car) => car.id === TOGG)!.updatedAt;
    expect(returnMockCar(name, TOGG, version).status).toBe("ok");
    expect(fleetSummary(name, EGE).greenVehicles).toBe(0);
    expect(sampleGreen(name, EGE, "2000-01", "2100-01", Date.now()).vehicles).toEqual([]);
    expect(sampleStations(name, EGE, "35 FLM 102", 5, NOW)).toBeNull();
  });
});

describe("the sample stations", () => {
  it("are the nearest first from the centre of the contract's city, with a state, and the simulation flag", () => {
    const list = sampleStations(world(), EGE, "35flm102", 5, NOW)!;
    expect(list.simulated).toBe(true);
    expect(list.vehicle).toMatchObject({ plate: "35 FLM 102", city: "İzmir" });
    expect(list.items).toHaveLength(5);
    const distances = list.items.map((item) => item.distanceKm!);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(list.items.every((item) => item.city === "İzmir")).toBe(true);
    for (const item of list.items) expect(item.status).toBe(stationStatus(item.id, sliceOf(NOW)));
    expect(list.updatedAt).toBe("2026-10-31T10:05:00.000Z");
  });

  it("give the same answer for the same car and the same five minutes, and a limit narrows them", () => {
    const name = world();
    expect(sampleStations(name, EGE, "35 FLM 102", 5, NOW)).toEqual(sampleStations(name, EGE, "35 FLM 102", 5, NOW + 120_000));
    expect(sampleStations(name, EGE, "35 FLM 102", 2, NOW)!.items).toHaveLength(2);
    expect(MOCK_STATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it("are not there for a petrol car, another company's car or a plate that cannot be one", () => {
    const name = world();
    expect(sampleStations(name, EGE, "35 FLM 101", 5, NOW)).toBeNull();
    expect(sampleStations(name, OTHER, "35 FLM 102", 5, NOW)).toBeNull();
    expect(sampleStations(name, EGE, "nope", 5, NOW)).toBeNull();
  });
});

describe("the screen", () => {
  const car = (plate: string, fuel: "ELECTRIC" | "HYBRID"): GreenVehicle => ({ id: plate, plate, model: "X", fuel, charge: null, batteryHealth: null, batteryTrend: [], km: 0, savedGrams: 0 });

  it("shows the car the address names, else the first electric one, else the first", () => {
    const cars = [car("34 AAA 100", "HYBRID"), car("34 BBB 200", "ELECTRIC"), car("34 CCC 300", "ELECTRIC")];
    expect(pickVehicle(cars, "34ccc300")?.plate).toBe("34 CCC 300");
    expect(pickVehicle(cars, undefined)?.plate).toBe("34 BBB 200");
    expect(pickVehicle(cars, "yok")?.plate).toBe("34 BBB 200");
    expect(pickVehicle([car("34 AAA 100", "HYBRID")], undefined)?.plate).toBe("34 AAA 100");
    expect(pickVehicle([], undefined)).toBeNull();
  });

  it("every state has a tone and a word, in both languages", () => {
    expect((["AVAILABLE", "BUSY", "OUT_OF_ORDER"] as const).map(stationTone)).toEqual(["success", "warning", "error"]);
    for (const language of [tr, en]) for (const key of ["AVAILABLE", "BUSY", "OUT_OF_ORDER"] as const) expect(language.FleetPanel.green.stationStatus[key]).toBeTruthy();
  });

  it("is in the menu and the router, and has its words in both languages", () => {
    const entry = FLEET_SCREENS.find((screen) => screen.key === "green")!;
    expect(Object.keys(routing.pathnames)).toContain(entry.href);
    for (const language of [tr, en]) expect(language.FleetPanel.nav.green).toBeTruthy();
  });

  it("the lines of the chart share one scale, from a floor under the lowest reading to 100 %", () => {
    const a = [{ at: "2026-05-01T00:00:00Z", percent: 98 }, { at: "2026-11-01T00:00:00Z", percent: 92 }];
    const b = [{ at: "2026-08-01T00:00:00Z", percent: 95 }];
    const { floor, points } = lineGeometry([a, b]);
    expect(floor).toBe(85);
    expect(points[0]![0]).toEqual({ x: 0, y: ((100 - 98) / 15) * 100 });
    expect(points[0]![1]!.x).toBe(100);
    expect(points[1]![0]!.x).toBeGreaterThan(0);
    expect(points[1]![0]!.x).toBeLessThan(100);
    expect(lineGeometry([[]]).points).toEqual([[]]);
    expect(lineGeometry([[{ at: "2026-05-01T00:00:00Z", percent: 99 }]]).points[0]![0]!.x).toBe(50);
  });
});
