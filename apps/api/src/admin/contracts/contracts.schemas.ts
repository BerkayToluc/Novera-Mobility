import { z } from 'zod';
import { isProvince } from '../../common/provinces.js';
import { field } from '../../common/zod-fields.js';
import { DAY_PATTERN, parseDay } from '../../fleet/fleet-dates.js';
import { instant, optional } from '../../fleet/fleet.schemas.js';
import { required, sent, text, versionField, type Check } from '../admin-fields.js';
import { normalizePlate } from '../vehicles/vehicles.view.js';
import { SLUG } from '../vehicle-models/vehicle-models.schemas.js';

// The input of the contract and fleet vehicle endpoints of the administration (V2-35, docs/FLEET.md §4.2). Field problems are the
// fixed codes of ADR-17.

// A calendar day, "2026-10-31", that is a real one.
const day: Check<Date> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'string' || !DAY_PATTERN.test(raw)) return { code: 'INVALID_FORMAT' };
  const parsed = parseDay(raw);
  return parsed ? { value: parsed } : { code: 'INVALID_FORMAT' };
};

// A whole number between two limits.
const whole =
  (min: number, max: number): Check<number> =>
  (raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
    return raw < min || raw > max ? { code: 'OUT_OF_RANGE' } : { value: raw };
  };

// The product the contract is for, by its slug; that it exists is checked against the database (UNKNOWN_REFERENCE).
const productSlug: Check<string> = (raw) => {
  const result = text(60)(raw);
  return 'code' in result ? result : SLUG.test(result.value) ? result : { code: 'INVALID_FORMAT' };
};

const city: Check<string> = (raw) => {
  const result = text(60)(raw);
  if ('code' in result) return result;
  return isProvince(result.value) ? result : { code: 'INVALID_FORMAT' };
};

// TRY kuruş: at least 1 kuruş (the database says > 0), at most 100 million TRY a month.
export const MAX_MONTHLY_FEE = 10_000_000_000;
const status: Check<'ACTIVE' | 'ENDED'> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return raw === 'ACTIVE' || raw === 'ENDED' ? { value: raw } : { code: 'INVALID_FORMAT' };
};

export const createContractSchema = z.object({
  productSlug: required(productSlug),
  startAt: required(day),
  endAt: required(day),
  monthlyFee: required(whole(1, MAX_MONTHLY_FEE)),
  deliveryCity: required(city),
});

// A change names the version it was made against and only what it changes. The product and the start day do not change.
export const updateContractSchema = z.object({
  updatedAt: versionField(),
  endAt: sent(day),
  monthlyFee: sent(whole(1, MAX_MONTHLY_FEE)),
  deliveryCity: sent(city),
  status: sent(status),
});

// ---------- Fleet vehicles ----------
export const MIN_YEAR = 2000;
export const MAX_KM = 2_000_000;

const plate: Check<string> = (raw) => {
  const result = text(30)(raw);
  if ('code' in result) return result;
  const normal = normalizePlate(result.value);
  return normal ? { value: normal } : { code: 'INVALID_FORMAT' };
};

const modelSlug: Check<string> = (raw) => {
  const result = text(60)(raw);
  return 'code' in result ? result : SLUG.test(result.value) ? result : { code: 'INVALID_FORMAT' };
};

// A day that may be left out (`null`), or cleared on a change.
const optionalDay = optional(day);

export const createFleetVehicleSchema = z.object({
  modelSlug: required(modelSlug),
  plate: required(plate),
  year: required(whole(MIN_YEAR, new Date().getUTCFullYear() + 1)),
  startKm: required(whole(0, MAX_KM)),
  nextMaintenanceOn: field(optionalDay),
  inspectionDueOn: field(optionalDay),
});

// What a change can touch: the two dates, and giving the car back. The plate, the year and the model do not change.
const returned: Check<true> = (raw) => (raw === true ? { value: true } : { code: 'INVALID_FORMAT' });
export const updateFleetVehicleSchema = z.object({
  updatedAt: versionField(),
  nextMaintenanceOn: sent(optionalDay),
  inspectionDueOn: sent(optionalDay),
  returned: sent(returned),
});

// A percentage of 0 to 100, that may be left out.
const percent = optional(whole(0, 100));

export const createReadingSchema = z.object({
  km: required(whole(0, MAX_KM)),
  fuelPercent: field(percent),
  chargePercent: field(percent),
  batteryHealthPercent: field(percent),
  at: field(instant),
});
