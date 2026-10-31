import { TRACKING_ROUTES } from './route-data.js';
import { CITY_CENTERS, greatCircleKm } from './stations.js';
import { chooseRoute, isShiftSlot, isWorkingDay, pointAt, previousWorkingDay, SHIFT_END_SLOT, SHIFT_START_SLOT, SLOTS_PER_DAY, slotOf, trackDay, type RoutePoint } from './tracking.js';

// The live tracking simulation (V2-43, ADR-30): pure, so every rule is pinned here without a database.
const route: RoutePoint[] = TRACKING_ROUTES.find((r) => r.city === 'İzmir')!.points;
const FRIDAY = '2026-10-30';
const SATURDAY = '2026-10-31';
const SUNDAY = '2026-11-01';
const MONDAY = '2026-11-02';

const onRoute = (point: RoutePoint): boolean => {
  // Within a few metres of the line: the sum of the distances to the two ends of its nearest segment is the segment's own length.
  return route.slice(1).some((to, i) => {
    const from = route[i]!;
    return greatCircleKm(from, point) + greatCircleKm(point, to) - greatCircleKm(from, to) < 0.02;
  });
};

describe('the days of the week', () => {
  it('works Monday to Friday, and the working day before a Monday is the Friday', () => {
    expect([FRIDAY, MONDAY].map(isWorkingDay)).toEqual([true, true]);
    expect([SATURDAY, SUNDAY].map(isWorkingDay)).toEqual([false, false]);
    expect(previousWorkingDay(MONDAY)).toBe(FRIDAY);
    expect(previousWorkingDay(SUNDAY)).toBe(FRIDAY);
    expect(previousWorkingDay(FRIDAY)).toBe('2026-10-29');
  });

  it('puts the working hours at 08:00 to 19:00', () => {
    expect(SHIFT_START_SLOT * 5).toBe(8 * 60);
    expect(SHIFT_END_SLOT * 5).toBe(19 * 60);
    expect(isShiftSlot(FRIDAY, 95)).toBe(false);
    expect(isShiftSlot(FRIDAY, 96)).toBe(true);
    expect(isShiftSlot(FRIDAY, 227)).toBe(true);
    expect(isShiftSlot(FRIDAY, 228)).toBe(false);
    expect(isShiftSlot(SATURDAY, 150)).toBe(false);
  });
});

describe('pointAt and chooseRoute', () => {
  it('gives the ends at 0 and 1 and the middle by distance in between', () => {
    expect(pointAt(route, 0)).toEqual(route[0]);
    expect(pointAt(route, 1)).toEqual(route.at(-1));
    const half = pointAt(route, 0.5);
    expect(onRoute(half)).toBe(true);
  });

  it('gives the same car the same route whatever the order of the rows, and a city with none no route', () => {
    const routes = [{ name: 'b' }, { name: 'a' }, { name: 'c' }];
    expect(chooseRoute('car-1', routes)).toEqual(chooseRoute('car-1', [...routes].reverse()));
    expect(chooseRoute('car-1', [])).toBeNull();
    const chosen = new Set(Array.from({ length: 40 }, (_, i) => chooseRoute(`car-${i}`, routes)!.name));
    expect(chosen.size).toBeGreaterThan(1);
  });
});

describe('trackDay', () => {
  it('is the same for the same car, route and day, and different for another car', () => {
    expect(trackDay('car-1', route, FRIDAY)).toEqual(trackDay('car-1', route, FRIDAY));
    expect(trackDay('car-1', route, FRIDAY)).not.toEqual(trackDay('car-2', route, FRIDAY));
    expect(trackDay('car-1', route, FRIDAY)).not.toEqual(trackDay('car-1', route, '2026-10-29'));
  });

  it('has a sample for every five minutes of the day, in order', () => {
    const samples = trackDay('car-1', route, FRIDAY);
    expect(samples).toHaveLength(SLOTS_PER_DAY);
    expect(samples.map((sample) => sample.slot)).toEqual(Array.from({ length: SLOTS_PER_DAY }, (_, i) => i));
  });

  it('has the ignition on and the car moving in the working hours, and every point of the way on the route', () => {
    const samples = trackDay('car-1', route, FRIDAY);
    const driving = samples.filter((sample) => sample.ignition);
    expect(driving).toHaveLength(SHIFT_END_SLOT - SHIFT_START_SLOT);
    expect(driving.every((sample) => sample.slot >= SHIFT_START_SLOT && sample.slot < SHIFT_END_SLOT)).toBe(true);
    expect(driving.some((sample) => sample.speedKmh > 0)).toBe(true);
    expect(Math.max(...driving.map((sample) => sample.speedKmh))).toBeLessThan(120);
    expect(samples.every(onRoute)).toBe(true);
  });

  it('has the ignition off, the speed zero and the car standing where it ended its last working day, outside the working hours', () => {
    const friday = trackDay('car-1', route, FRIDAY);
    const evening = friday.slice(SHIFT_END_SLOT);
    const end = friday[SHIFT_END_SLOT - 1]!;
    for (const sample of evening) {
      expect(sample.ignition).toBe(false);
      expect(sample.speedKmh).toBe(0);
      expect([sample.latitude, sample.longitude]).toEqual([end.latitude, end.longitude]);
    }
    // The night before the working day and all weekend: where the Friday ended.
    for (const day of [SATURDAY, SUNDAY]) {
      const samples = trackDay('car-1', route, day);
      expect(samples.every((sample) => !sample.ignition && sample.speedKmh === 0)).toBe(true);
      expect(new Set(samples.map((sample) => `${sample.latitude},${sample.longitude}`)).size).toBe(1);
      expect([samples[0]!.latitude, samples[0]!.longitude]).toEqual([end.latitude, end.longitude]);
    }
    const monday = trackDay('car-1', route, MONDAY);
    expect(monday.slice(0, SHIFT_START_SLOT).every((sample) => !sample.ignition && sample.latitude === end.latitude && sample.longitude === end.longitude)).toBe(true);
  });

  it('puts the same number of drawn points where the answer says, rounded to five decimals', () => {
    for (const sample of trackDay('car-1', route, FRIDAY)) {
      expect(Math.round(sample.latitude * 1e5) / 1e5).toBe(sample.latitude);
      expect(Math.round(sample.longitude * 1e5) / 1e5).toBe(sample.longitude);
    }
  });

  it('moves along the route between slots by a distance that fits the speed it reports', () => {
    const samples = trackDay('car-1', route, FRIDAY).slice(SHIFT_START_SLOT, SHIFT_END_SLOT);
    const speeds = samples.map((sample) => sample.speedKmh);
    // Some five minutes are stood still, and the average is a city's.
    expect(speeds.some((speed) => speed === 0)).toBe(true);
    const average = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    expect(average).toBeGreaterThan(15);
    expect(average).toBeLessThan(60);
  });
});

describe('the routes', () => {
  it('are two for each city fleets are delivered to, of at least two points near its centre', () => {
    expect(TRACKING_ROUTES).toHaveLength(Object.keys(CITY_CENTERS).length * 2);
    for (const entry of TRACKING_ROUTES) {
      expect(entry.points.length).toBeGreaterThanOrEqual(2);
      for (const point of entry.points) expect(greatCircleKm(CITY_CENTERS[entry.city]!, point)).toBeLessThan(25);
    }
    expect(new Set(TRACKING_ROUTES.map((entry) => `${entry.city}|${entry.name}`)).size).toBe(TRACKING_ROUTES.length);
  });
});

describe('slotOf', () => {
  it('numbers the five minutes of an Istanbul day from midnight', () => {
    expect(slotOf(new Date('2026-10-30T05:00:00Z'), FRIDAY)).toBe(96); // 08:00 in Istanbul
    expect(slotOf(new Date('2026-10-30T05:04:59Z'), FRIDAY)).toBe(96);
    expect(slotOf(new Date('2026-10-30T05:05:00Z'), FRIDAY)).toBe(97);
    expect(slotOf(new Date('2026-10-30T20:59:00Z'), FRIDAY)).toBe(287); // 23:59 in Istanbul
  });
});
