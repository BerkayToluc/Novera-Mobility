import { describe, expect, it } from "vitest";
import { chooseRoute, istanbulDate, isShiftSlot, isWorkingDay, previousWorkingDay, slotOf, trackDay } from "@/lib/simulation";
import { addDaysToDate, ignitionTone, onMap, pickDay, pickTracked, pinNumber, REFRESH_MS, ROUTE_DAYS, routeDays, type TrackedVehicle } from "@/lib/tracking";
import { listMockCompanyCars, returnMockCar } from "@/mocks/admin-contracts";
import { mockRoutes, sampleRoute, sampleTracking } from "@/mocks/tracking";
import { en, tr } from "../i18n/messages";
import { routing } from "../i18n/routing";
import { FLEET_SCREENS } from "../lib/fleet-screens";

// The live tracking screen's rules (V2-43) without a browser: the simulation (the same arithmetic as the API's), the sample cars and
// routes, and the small rules of the screen. The same rules against the real API and the database are in
// apps/api/src/fleet/fleet-tracking.integration.spec.ts.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const OTHER = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
let counter = 0;
const world = () => `tracking-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;
// A Friday at 11:07 Istanbul, a Friday night and a Saturday.
const FRIDAY = Date.parse("2026-10-30T08:07:00.000Z");
const FRIDAY_NIGHT = Date.parse("2026-10-30T19:30:00.000Z");
const SATURDAY = Date.parse("2026-10-31T09:00:00.000Z");

describe("the simulation is the API's (ADR-30)", () => {
  it("gives the very numbers the API gives for the same car, route and day (pinned from apps/api/src/fleet/simulation/tracking.ts)", () => {
    const key = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e91";
    const route = chooseRoute(key, mockRoutes("İzmir"))!;
    expect(route.name).toBe("İzmir Çevre yolu hattı");
    expect(route.points[0]).toEqual({ latitude: 38.3937, longitude: 27.1028 });
    const friday = trackDay(key, route.points, "2026-10-30");
    const at = (slot: number) => friday[slot]!;
    expect(at(0)).toEqual({ slot: 0, latitude: 38.41619, longitude: 27.09156, speedKmh: 0, ignition: false });
    expect(at(96)).toEqual({ slot: 96, latitude: 38.46377, longitude: 27.12967, speedKmh: 50, ignition: true });
    expect(at(100)).toEqual({ slot: 100, latitude: 38.42805, longitude: 27.19562, speedKmh: 31, ignition: true });
    expect(at(150)).toEqual({ slot: 150, latitude: 38.42892, longitude: 27.09041, speedKmh: 0, ignition: true });
    expect(at(227)).toEqual({ slot: 227, latitude: 38.44151, longitude: 27.18889, speedKmh: 29, ignition: true });
    expect(at(228)).toEqual({ slot: 228, latitude: 38.44151, longitude: 27.18889, speedKmh: 0, ignition: false });
    expect(trackDay(key, route.points, "2026-10-31")[150]).toEqual({ slot: 150, latitude: 38.44151, longitude: 27.18889, speedKmh: 0, ignition: false });
  });

  it("works Monday to Friday from 08:00 to 19:00, and the working day before a Monday is the Friday", () => {
    expect([isWorkingDay("2026-10-30"), isWorkingDay("2026-10-31"), isWorkingDay("2026-11-01"), isWorkingDay("2026-11-02")]).toEqual([true, false, false, true]);
    expect(previousWorkingDay("2026-11-02")).toBe("2026-10-30");
    expect([95, 96, 227, 228].map((slot) => isShiftSlot("2026-10-30", slot))).toEqual([false, true, true, false]);
  });

  it("numbers the five minutes of an Istanbul day from midnight", () => {
    expect(istanbulDate(Date.parse("2026-10-30T21:30:00Z"))).toBe("2026-10-31");
    expect(slotOf(Date.parse("2026-10-30T05:00:00Z"), "2026-10-30")).toBe(96);
    expect(slotOf(Date.parse("2026-10-30T05:05:00Z"), "2026-10-30")).toBe(97);
  });
});

describe("the sample tracking", () => {
  it("lists the cars of the company in use, by plate, with a place on a route of their city and the person who has them", () => {
    const list = sampleTracking(world(), EGE, FRIDAY);
    expect(list.simulated).toBe(true);
    expect(list.items.map((item) => item.plate)).toEqual(["35 FLM 101", "35 FLM 102"]);
    for (const item of list.items) {
      expect(item.city).toBe("İzmir");
      expect(item.position).not.toBeNull();
      expect(item.ignition).toBe(true);
    }
    expect(list.updatedAt).toBe("2026-10-30T08:05:00.000Z");
  });

  it("gives the same answer for the same five minutes and moves the cars in the next", () => {
    const name = world();
    expect(sampleTracking(name, EGE, FRIDAY)).toEqual(sampleTracking(name, EGE, FRIDAY + 60_000));
    expect(sampleTracking(name, EGE, FRIDAY + 10 * 60_000).items.map((item) => item.position)).not.toEqual(sampleTracking(name, EGE, FRIDAY).items.map((item) => item.position));
  });

  it("has the ignition off, the speed zero and the cars standing at night and at the weekend", () => {
    const name = world();
    const night = sampleTracking(name, EGE, FRIDAY_NIGHT);
    const saturday = sampleTracking(name, EGE, SATURDAY);
    for (const list of [night, saturday]) expect(list.items.every((item) => !item.ignition && item.speedKmh === 0)).toBe(true);
    expect(saturday.items.map((item) => item.position)).toEqual(night.items.map((item) => item.position));
  });

  it("is empty for a company with no car, and a car given back is gone", () => {
    const name = world();
    expect(sampleTracking(name, "none", FRIDAY).items).toEqual([]);
    const car = listMockCompanyCars(name, EGE).find((entry) => entry.plate === "35 FLM 102")!;
    expect(returnMockCar(name, car.id, car.updatedAt).status).toBe("ok");
    expect(sampleTracking(name, EGE, FRIDAY).items.map((item) => item.plate)).toEqual(["35 FLM 101"]);
    expect(sampleRoute(name, EGE, "35 FLM 102", undefined, FRIDAY)).toBeNull();
  });

  it("gives a route of every five minutes up to now for today and the whole day for a day that is over", () => {
    const name = world();
    const today = sampleRoute(name, EGE, "35flm101", undefined, FRIDAY);
    expect(today).not.toBeNull();
    expect(today).not.toBe("out_of_range");
    const day = today as Exclude<typeof today, null | "out_of_range">;
    expect(day.date).toBe("2026-10-30");
    expect(day.points).toHaveLength(slotOf(FRIDAY, "2026-10-30") + 1);
    const past = sampleRoute(name, EGE, "35 FLM 101", "2026-10-29", FRIDAY) as typeof day;
    expect(past.points).toHaveLength(288);
    // The last point of today is where the list says the car is now.
    const listed = sampleTracking(name, EGE, FRIDAY).items.find((item) => item.plate === "35 FLM 101")!;
    expect({ latitude: day.points.at(-1)!.latitude, longitude: day.points.at(-1)!.longitude }).toEqual(listed.position);
  });

  it("refuses a day after today or before the last seven, and does not know another company's car", () => {
    const name = world();
    expect(sampleRoute(name, EGE, "35 FLM 101", "2026-10-31", FRIDAY)).toBe("out_of_range");
    expect(sampleRoute(name, EGE, "35 FLM 101", "2026-10-23", FRIDAY)).toBe("out_of_range");
    expect(sampleRoute(name, EGE, "35 FLM 101", "2026-10-24", FRIDAY)).not.toBe("out_of_range");
    expect(sampleRoute(name, OTHER, "35 FLM 101", undefined, FRIDAY)).toBeNull();
    expect(sampleRoute(name, EGE, "!!", undefined, FRIDAY)).toBeNull();
  });
});

describe("the rules of the screen", () => {
  const car = (plate: string, position: TrackedVehicle["position"]): TrackedVehicle => ({ plate, model: "Fiat Egea", city: "İzmir", employee: null, ignition: true, speedKmh: 30, position });
  const items = [car("35 FLM 101", { latitude: 38, longitude: 27 }), car("35 FLM 102", null), car("35 FLM 103", { latitude: 38.1, longitude: 27.1 })];

  it("renews every thirty seconds", () => {
    expect(REFRESH_MS).toBe(30_000);
  });

  it("asks for today and the six days before it, newest first", () => {
    expect(ROUTE_DAYS).toBe(7);
    expect(routeDays("2026-11-02")).toEqual(["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30", "2026-10-29", "2026-10-28", "2026-10-27"]);
    expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("takes a day of the address only if the route can be asked for it, else today", () => {
    expect(pickDay("2026-10-29", "2026-10-31")).toBe("2026-10-29");
    for (const wanted of ["2026-11-01", "2026-10-24", "dün", "", undefined]) expect(pickDay(wanted, "2026-10-31")).toBe("2026-10-31");
  });

  it("takes a car of the address with or without spaces, and none if it is not in the list", () => {
    expect(pickTracked(items, "35FLM101")?.plate).toBe("35 FLM 101");
    expect(pickTracked(items, "35 flm 103")?.plate).toBe("35 FLM 103");
    expect(pickTracked(items, "34 ABC 123")).toBeNull();
    expect(pickTracked(items, undefined)).toBeNull();
  });

  it("puts on the map only the cars that have a place, and numbers every car by its place in the list", () => {
    expect(onMap(items).map((item) => item.plate)).toEqual(["35 FLM 101", "35 FLM 103"]);
    expect([pinNumber(items, "35 FLM 101"), pinNumber(items, "35 FLM 102"), pinNumber(items, "35 FLM 103")]).toEqual([1, 2, 3]);
  });

  it("writes a word and a colour for the ignition, never the colour alone", () => {
    expect(ignitionTone(true)).toBe("success");
    expect(ignitionTone(false)).toBe("neutral");
  });

  it("has an address in both languages, a menu entry, and the same words in Turkish and English", () => {
    expect(routing.pathnames["/filom/canli-takip"]).toEqual({ tr: "/filom/canli-takip", en: "/my-fleet/live-tracking" });
    expect(FLEET_SCREENS.map((screen) => screen.key)).toContain("tracking");
    const keys = (value: unknown, prefix = ""): string[] => (typeof value === "object" && value !== null ? Object.entries(value).flatMap(([key, inner]) => keys(inner, `${prefix}${key}.`)) : [prefix]);
    const trTracking = (tr as { FleetPanel: { tracking: unknown } }).FleetPanel.tracking;
    const enTracking = (en as { FleetPanel: { tracking: unknown } }).FleetPanel.tracking;
    expect(keys(trTracking).sort()).toEqual(keys(enTracking).sort());
  });
});
