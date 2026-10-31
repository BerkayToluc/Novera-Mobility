import { istanbulDateStart } from '../../common/time.js';
import { seeded, SLICE_MS, sliceOf } from './slice.js';
import { greatCircleKm } from './stations.js';

// The simulated position of a car on the road (V2-43, ADR-30, docs/FLEET.md §3.1). Pure and deterministic: the same car, route and five
// minutes give the same answer for everybody, nothing is stored, and a test can pin any moment.
//
// How a day goes: on a weekday the car is on the road from 08:00 to 19:00 (Istanbul), ignition on, going to and fro along its route. Outside
// those hours, and all weekend, the ignition is off, the speed is zero and the car stands where it ended its last working day. Each
// working day begins somewhere else on the route (the car is taken to where it starts), so the days do not repeat one another.
export type RoutePoint = { latitude: number; longitude: number };
export type TrackSample = { slot: number; latitude: number; longitude: number; speedKmh: number; ignition: boolean };

export const SLOTS_PER_DAY = 288;
export const SHIFT_START_SLOT = 96; // 08:00
export const SHIFT_END_SLOT = 228; // 19:00, the first slot of the evening
const AVERAGE_KMH = 35;
// A car stands still (a light, a delivery) in about one slot in ten.
const STOPPED_SHARE = 0.1;

const routeKm = (route: readonly RoutePoint[]): number => route.slice(1).reduce((sum, point, index) => sum + greatCircleKm(route[index]!, point), 0);

// The point at `fraction` (0..1) of the way along a route, by distance.
export function pointAt(route: readonly RoutePoint[], fraction: number): RoutePoint {
  const total = routeKm(route);
  let remaining = Math.min(1, Math.max(0, fraction)) * total;
  for (let i = 1; i < route.length; i += 1) {
    const length = greatCircleKm(route[i - 1]!, route[i]!);
    if (remaining <= length || i === route.length - 1) {
      const share = length === 0 ? 0 : Math.min(1, remaining / length);
      const from = route[i - 1]!;
      const to = route[i]!;
      return { latitude: from.latitude + (to.latitude - from.latitude) * share, longitude: from.longitude + (to.longitude - from.longitude) * share };
    }
    remaining -= length;
  }
  return route[0]!;
}

// The route of a car among those of its city: the same car always takes the same one. Sorted by name first, so the order of the rows does not matter.
export function chooseRoute<T extends { name: string }>(vehicleKey: string, routes: readonly T[]): T | null {
  if (routes.length === 0) return null;
  const sorted = [...routes].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return sorted[Math.min(sorted.length - 1, Math.floor(seeded(`route:${vehicleKey}`, 0) * sorted.length))]!;
}

const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
export const isWorkingDay = (date: string): boolean => weekday(date) !== 0 && weekday(date) !== 6;

const shiftDay = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// The last working day before `date` (itself not counted).
export function previousWorkingDay(date: string): string {
  let day = shiftDay(date, -1);
  while (!isWorkingDay(day)) day = shiftDay(day, -1);
  return day;
}

// Where along the route a position `progress` is: the car goes there and back, so 0..1 is one way and 1..2 the way back.
const alongRoute = (progress: number): number => {
  const lap = ((progress % 2) + 2) % 2;
  return lap <= 1 ? lap : 2 - lap;
};

// The slots of a working day: for each, how far along the route the car is and how fast it was going to get there.
function shift(vehicleKey: string, route: readonly RoutePoint[], date: string): Array<{ fraction: number; speedKmh: number }> {
  const km = routeKm(route);
  const midnight = istanbulDateStart(date);
  // The share of the route a car covers in five minutes at the average speed.
  const base = km === 0 ? 0 : AVERAGE_KMH / 12 / km;
  let progress = 2 * seeded(`start:${vehicleKey}:${date}`, 0);
  const out: Array<{ fraction: number; speedKmh: number }> = [];
  for (let slot = SHIFT_START_SLOT; slot < SHIFT_END_SLOT; slot += 1) {
    const r = seeded(`step:${vehicleKey}`, sliceOf(new Date(midnight.getTime() + slot * SLICE_MS)));
    const step = r < STOPPED_SHARE ? 0 : base * (0.4 + (1.2 * (r - STOPPED_SHARE)) / (1 - STOPPED_SHARE));
    progress += step;
    out.push({ fraction: alongRoute(progress), speedKmh: Math.round(step * km * 12) });
  }
  return out;
}

// Whether the ignition is on in a slot of a day. Needs no route: the working hours and days only (a car with no route has no position,
// but it can still be said to be running).
export const isShiftSlot = (date: string, slot: number): boolean => isWorkingDay(date) && slot >= SHIFT_START_SLOT && slot < SHIFT_END_SLOT;

const round = (point: RoutePoint): RoutePoint => ({ latitude: Math.round(point.latitude * 1e5) / 1e5, longitude: Math.round(point.longitude * 1e5) / 1e5 });

// Every five minutes of a day, 288 samples.
export function trackDay(vehicleKey: string, route: readonly RoutePoint[], date: string): TrackSample[] {
  const today = isWorkingDay(date) ? shift(vehicleKey, route, date) : null;
  // Where the car stands before the working day begins, and all weekend: where it ended the last working day before this one.
  const overnight = shift(vehicleKey, route, previousWorkingDay(date)).at(-1)!.fraction;
  const evening = today ? today.at(-1)!.fraction : overnight;
  return Array.from({ length: SLOTS_PER_DAY }, (_, slot): TrackSample => {
    if (today && isShiftSlot(date, slot)) {
      const moment = today[slot - SHIFT_START_SLOT]!;
      return { slot, ...round(pointAt(route, moment.fraction)), speedKmh: moment.speedKmh, ignition: true };
    }
    const parked = today && slot >= SHIFT_END_SLOT ? evening : overnight;
    return { slot, ...round(pointAt(route, parked)), speedKmh: 0, ignition: false };
  });
}

// The Istanbul day an instant is in and its slot (0..287) in it.
export function slotOf(at: Date, date: string): number {
  return Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.floor((at.getTime() - istanbulDateStart(date).getTime()) / SLICE_MS)));
}
