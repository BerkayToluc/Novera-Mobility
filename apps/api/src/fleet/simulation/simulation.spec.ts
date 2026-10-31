import { carbonSavedGrams, EMISSION_G_PER_KM, PETROL_G_PER_KM } from '../fleet-report.js';
import { seeded, sliceOf, sliceStart, SLICE_MS } from './slice.js';
import { CITY_CENTERS, distanceKm, stationStatus } from './stations.js';

describe('the simulation is the same for the same car and the same five minutes (ADR-30, V2-40)', () => {
  it('cuts time into five-minute slices', () => {
    const start = new Date('2026-10-31T10:05:00.000Z');
    expect(sliceStart(sliceOf(start)).toISOString()).toBe('2026-10-31T10:05:00.000Z');
    expect(sliceOf(new Date(start.getTime() + SLICE_MS - 1))).toBe(sliceOf(start));
    expect(sliceOf(new Date(start.getTime() + SLICE_MS))).toBe(sliceOf(start) + 1);
  });

  it('gives the same number for the same key and slice, a different one for another, always in [0, 1)', () => {
    expect(seeded('station:a', 42)).toBe(seeded('station:a', 42));
    expect(seeded('station:a', 42)).not.toBe(seeded('station:b', 42));
    expect(seeded('station:a', 42)).not.toBe(seeded('station:a', 43));
    for (let slice = 0; slice < 2000; slice += 1) {
      const value = seeded('station:x', slice);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('a station has the same state for the same slice, however often it is asked, and the states move over time', () => {
    const slice = sliceOf(new Date('2026-10-31T10:07:00.000Z'));
    for (let call = 0; call < 5; call += 1) expect(stationStatus('c0ffee', slice)).toBe(stationStatus('c0ffee', slice));
    const seen = new Set(Array.from({ length: 200 }, (_, index) => stationStatus('c0ffee', slice + index)));
    expect(seen).toEqual(new Set(['AVAILABLE', 'BUSY', 'OUT_OF_ORDER']));
  });

  it('about six in ten stations are free, three in ten in use, one in ten out of order', () => {
    const counts = { AVAILABLE: 0, BUSY: 0, OUT_OF_ORDER: 0 };
    for (let id = 0; id < 4000; id += 1) counts[stationStatus(`station-${id}`, 123)] += 1;
    expect(counts.AVAILABLE / 4000).toBeGreaterThan(0.55);
    expect(counts.AVAILABLE / 4000).toBeLessThan(0.65);
    expect(counts.BUSY / 4000).toBeGreaterThan(0.25);
    expect(counts.BUSY / 4000).toBeLessThan(0.35);
    expect(counts.OUT_OF_ORDER / 4000).toBeGreaterThan(0.06);
    expect(counts.OUT_OF_ORDER / 4000).toBeLessThan(0.14);
  });
});

describe('distance', () => {
  it('is the great-circle distance to a decimal: zero to itself, symmetrical, about 350 km from Ankara to Istanbul', () => {
    expect(distanceKm(CITY_CENTERS['Ankara']!, CITY_CENTERS['Ankara']!)).toBe(0);
    expect(distanceKm(CITY_CENTERS['Ankara']!, CITY_CENTERS['İstanbul']!)).toBe(distanceKm(CITY_CENTERS['İstanbul']!, CITY_CENTERS['Ankara']!));
    expect(distanceKm(CITY_CENTERS['Ankara']!, CITY_CENTERS['İstanbul']!)).toBeGreaterThan(340);
    expect(distanceKm(CITY_CENTERS['Ankara']!, CITY_CENTERS['İstanbul']!)).toBeLessThan(360);
  });
});

describe('the carbon saved (docs/FLEET.md §3.1)', () => {
  it('uses the factors of the document: petrol 0.170 kg/km, hybrid 0.105, electric 0.045', () => {
    expect(PETROL_G_PER_KM).toBe(170);
    expect(EMISSION_G_PER_KM).toEqual({ HYBRID: 105, ELECTRIC: 45 });
  });

  it('is the kilometres times what a petrol car gives off less what this one does, in whole grams', () => {
    expect(carbonSavedGrams('ELECTRIC', 1_000)).toBe(1_000 * (170 - 45));
    expect(carbonSavedGrams('HYBRID', 1_000)).toBe(1_000 * (170 - 105));
    expect(carbonSavedGrams('ELECTRIC', 0)).toBe(0);
    expect(carbonSavedGrams('ELECTRIC', -5)).toBe(0);
    expect(Number.isInteger(carbonSavedGrams('HYBRID', 12.6))).toBe(true);
  });
});
