import type { components } from "./api-types";
import type { StatusTone } from "@/components/admin/status-chip";
import type { StationStatus } from "./simulation";

// The Green Fleet screen (V2-40, docs/FLEET.md §3, §3.1): what the API answers, and the little arithmetic of the screen. Pure, so the same
// rules are tested without a browser.
type Schemas = components["schemas"];
export type GreenReport = Schemas["GreenReport"];
export type GreenVehicle = Schemas["GreenVehicle"];
export type StationList = Schemas["StationList"];
export type ChargingStation = Schemas["ChargingStation"];

export const STATION_STATUSES = ["AVAILABLE", "BUSY", "OUT_OF_ORDER"] as const satisfies readonly StationStatus[];

// A free station is the good news; one out of order is the one to avoid. The word is always written as well.
export const stationTone = (status: StationStatus): StatusTone => (status === "AVAILABLE" ? "success" : status === "BUSY" ? "warning" : "error");

export const STATIONS_SHOWN = 5;

// Kilograms to one decimal from the API's whole grams, written in the reader's language ("12,5").
export const kilograms = (grams: number, locale: string): string => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(grams / 1000);

// The vehicle whose stations are shown: the one the address names (`arac`, a plate with or without spaces), else the first electric car,
// else the first green car, else none.
export function pickVehicle(vehicles: readonly GreenVehicle[], wanted: string | undefined): GreenVehicle | null {
  const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  const named = wanted ? vehicles.find((vehicle) => compact(vehicle.plate) === compact(wanted)) : undefined;
  return named ?? vehicles.find((vehicle) => vehicle.fuel === "ELECTRIC") ?? vehicles[0] ?? null;
}

// A line chart's points: x is the share of the time between the first and the last reading, y the share of the way from the floor to 100 %.
// All the lines share one scale. The floor is the lowest reading rounded down to a multiple of five, less five, so the lines do not sit on
// the edge; never below zero.
export type LinePoint = { at: string; percent: number };
export function lineGeometry(series: ReadonlyArray<ReadonlyArray<LinePoint>>): { floor: number; first: number; last: number; points: Array<Array<{ x: number; y: number }>> } {
  const all = series.flat();
  if (all.length === 0) return { floor: 0, first: 0, last: 0, points: series.map(() => []) };
  const floor = Math.max(0, Math.floor(Math.min(...all.map((point) => point.percent)) / 5) * 5 - 5);
  const times = all.map((point) => Date.parse(point.at));
  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = last - first;
  return {
    floor,
    first,
    last,
    points: series.map((line) => line.map((point) => ({ x: span === 0 ? 50 : ((Date.parse(point.at) - first) / span) * 100, y: ((100 - point.percent) / (100 - floor)) * 100 }))),
  };
}
