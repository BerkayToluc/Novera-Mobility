import type { components } from "./api-types";
import type { StatusTone } from "@/components/admin/status-chip";

// The live tracking screen (V2-43, docs/FLEET.md §3, §3.1): what the API answers, and the little arithmetic of the screen. Pure, so the same
// rules are tested without a browser.
type Schemas = components["schemas"];
export type TrackingList = Schemas["TrackingList"];
export type TrackedVehicle = Schemas["TrackedVehicle"];
export type RouteDay = Schemas["RouteDay"];

// The list is asked for again this often while the tab is in view (the API's own limit, 120 a minute, is far above it).
export const REFRESH_MS = 30_000;
// The route of today and the six days before it can be asked for (the API's rule).
export const ROUTE_DAYS = 7;

export const addDaysToDate = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// The days a route can be asked for, newest first.
export const routeDays = (today: string): string[] => Array.from({ length: ROUTE_DAYS }, (_, index) => addDaysToDate(today, -index));

// Ignition on is the car at work; off is it standing. The word is always written as well as the colour.
export const ignitionTone = (ignition: boolean): StatusTone => (ignition ? "success" : "neutral");

// The car whose route is drawn: the one the address names (`arac`, a plate with or without spaces), else none: a route is drawn only when
// somebody picks a car, so the first screen is the whole fleet.
export function pickTracked(items: readonly TrackedVehicle[], wanted: string | undefined): TrackedVehicle | null {
  if (!wanted) return null;
  const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  return items.find((item) => compact(item.plate) === compact(wanted)) ?? null;
}

// A day in the address (`gun`) is used only if it is one the route can be asked for; anything else is today.
export function pickDay(wanted: string | undefined, today: string): string {
  return wanted && routeDays(today).includes(wanted) ? wanted : today;
}

// The cars that have a place on the map; the others are in the list only.
export const onMap = (items: readonly TrackedVehicle[]): TrackedVehicle[] => items.filter((item) => item.position !== null);

// The list's order is the API's (by plate); the pins on the map are numbered the same way so a pin and its row can be matched.
export const pinNumber = (items: readonly TrackedVehicle[], plate: string): number => items.findIndex((item) => item.plate === plate) + 1;

export type RefreshResult = { status: "ok"; tracking: TrackingList; route: RouteDay | null } | { status: "unavailable" };
