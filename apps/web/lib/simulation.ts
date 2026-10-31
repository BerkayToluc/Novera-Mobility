// The simulated data of Filom in the sample mode (V2-40, ARCHITECTURE ADR-30): the same arithmetic as the API's
// (apps/api/src/fleet/simulation/), so the sample screens show what the real ones would. The real site never runs this; it reads the API.
export const SLICE_MS = 5 * 60 * 1000;

export const sliceOf = (at: number): number => Math.floor(at / SLICE_MS);
export const sliceStart = (slice: number): number => slice * SLICE_MS;

// A number in [0, 1) that depends only on the key and the slice: FNV-1a over the text, then mulberry32.
export function seeded(key: string, slice: number): number {
  let hash = 0x811c9dc5;
  for (const char of `${key}|${slice}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  let t = (hash >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type StationStatus = "AVAILABLE" | "BUSY" | "OUT_OF_ORDER";

export function stationStatus(stationId: string, slice: number): StationStatus {
  const r = seeded(`station:${stationId}`, slice);
  return r < 0.6 ? "AVAILABLE" : r < 0.9 ? "BUSY" : "OUT_OF_ORDER";
}

// Great-circle distance in kilometres, to one decimal.
export function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// Grams of CO₂ per kilometre (docs/FLEET.md §3.1) and what driving a green car saves against a petrol one.
export const PETROL_G_PER_KM = 170;
export const EMISSION_G_PER_KM = { HYBRID: 105, ELECTRIC: 45 } as const;
export const carbonSavedGrams = (fuel: keyof typeof EMISSION_G_PER_KM, km: number): number => Math.max(0, Math.round(km)) * (PETROL_G_PER_KM - EMISSION_G_PER_KM[fuel]);

// ---------- Live tracking (V2-43) ----------
// The same arithmetic as apps/api/src/fleet/simulation/tracking.ts: a car goes to and fro along a route of its city on working days from
// 08:00 to 19:00 (Istanbul), and stands where it ended its last working day the rest of the time. A test pins the two to the same numbers.
export type RoutePoint = { latitude: number; longitude: number };
export type TrackSample = { slot: number; latitude: number; longitude: number; speedKmh: number; ignition: boolean };

export const SLOTS_PER_DAY = 288;
export const SHIFT_START_SLOT = 96;
export const SHIFT_END_SLOT = 228;
const AVERAGE_KMH = 35;
const STOPPED_SHARE = 0.1;

const greatCircleKm = (from: RoutePoint, to: RoutePoint): number => {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};
const routeKm = (route: readonly RoutePoint[]): number => route.slice(1).reduce((sum, point, index) => sum + greatCircleKm(route[index]!, point), 0);

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

export function chooseRoute<T extends { name: string }>(vehicleKey: string, routes: readonly T[]): T | null {
  if (routes.length === 0) return null;
  const sorted = [...routes].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return sorted[Math.min(sorted.length - 1, Math.floor(seeded(`route:${vehicleKey}`, 0) * sorted.length))]!;
}

const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
export const isWorkingDay = (date: string): boolean => weekday(date) !== 0 && weekday(date) !== 6;
const shiftDay = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export function previousWorkingDay(date: string): string {
  let day = shiftDay(date, -1);
  while (!isWorkingDay(day)) day = shiftDay(day, -1);
  return day;
}
export const isShiftSlot = (date: string, slot: number): boolean => isWorkingDay(date) && slot >= SHIFT_START_SLOT && slot < SHIFT_END_SLOT;

// Turkey has had one offset (+03:00) all year since 2016, so a day starts at midnight there.
export const dayStart = (date: string): number => Date.parse(`${date}T00:00:00+03:00`);
export const istanbulDate = (at: number): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
export const slotOf = (at: number, date: string): number => Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.floor((at - dayStart(date)) / SLICE_MS)));

const alongRoute = (progress: number): number => {
  const lap = ((progress % 2) + 2) % 2;
  return lap <= 1 ? lap : 2 - lap;
};

function shift(vehicleKey: string, route: readonly RoutePoint[], date: string): Array<{ fraction: number; speedKmh: number }> {
  const km = routeKm(route);
  const midnight = dayStart(date);
  const base = km === 0 ? 0 : AVERAGE_KMH / 12 / km;
  let progress = 2 * seeded(`start:${vehicleKey}:${date}`, 0);
  const out: Array<{ fraction: number; speedKmh: number }> = [];
  for (let slot = SHIFT_START_SLOT; slot < SHIFT_END_SLOT; slot += 1) {
    const r = seeded(`step:${vehicleKey}`, sliceOf(midnight + slot * SLICE_MS));
    const step = r < STOPPED_SHARE ? 0 : base * (0.4 + (1.2 * (r - STOPPED_SHARE)) / (1 - STOPPED_SHARE));
    progress += step;
    out.push({ fraction: alongRoute(progress), speedKmh: Math.round(step * km * 12) });
  }
  return out;
}

const round = (point: RoutePoint): RoutePoint => ({ latitude: Math.round(point.latitude * 1e5) / 1e5, longitude: Math.round(point.longitude * 1e5) / 1e5 });

export function trackDay(vehicleKey: string, route: readonly RoutePoint[], date: string): TrackSample[] {
  const today = isWorkingDay(date) ? shift(vehicleKey, route, date) : null;
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
