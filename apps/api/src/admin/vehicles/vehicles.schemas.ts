import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { isUuid } from '../../common/uuid.js';
import { required, sent, text, versionField, type Check } from '../admin-fields.js';
import { pageFields, sortField } from '../admin-list.js';
import { SLUG } from '../vehicle-models/vehicle-models.schemas.js';
import { normalizePlate, VEHICLE_STATUSES } from './vehicles.view.js';

// The input of the vehicle endpoints (V2-30, ADMIN.md §3.1). Field problems are the fixed codes of ADR-17.
export const MIN_YEAR = 2015;

const plate: Check<string> = (raw) => {
  const result = text(30)(raw);
  if ('code' in result) return result;
  const normal = normalizePlate(result.value);
  return normal ? { value: normal } : { code: 'INVALID_FORMAT' };
};

// The year of the car: from 2015 to next year (a car of the coming model year can be bought in the autumn).
export const maxYear = (now: Date = new Date()): number => now.getUTCFullYear() + 1;

const year =
  (now: () => Date): Check<number> =>
  (raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
    return raw < MIN_YEAR || raw > maxYear(now()) ? { code: 'OUT_OF_RANGE' } : { value: raw };
  };

const modelSlug: Check<string> = (raw) => {
  const result = text(60)(raw);
  return 'code' in result ? result : SLUG.test(result.value) ? result : { code: 'INVALID_FORMAT' };
};

// The branch by its id; that it exists and is open is checked against the database (UNKNOWN_REFERENCE).
const branchId: Check<string> = (raw) => {
  const result = text(60)(raw);
  return 'code' in result ? result : isUuid(result.value) ? result : { code: 'INVALID_FORMAT' };
};

const flag: Check<boolean> = (raw) => {
  if (raw === undefined || raw === null) return { code: 'REQUIRED' };
  return typeof raw === 'boolean' ? { value: raw } : { code: 'INVALID_FORMAT' };
};

// A new car is switched on from the start: the person adds it to rent it. `now` is a parameter so a test can pick the year.
export const createVehicleSchema = (now: () => Date = () => new Date()) =>
  z.object({
    plate: required(plate),
    year: required(year(now)),
    modelSlug: required(modelSlug),
    branchId: required(branchId),
  });

// What a change can touch: where the car is, and whether it is switched on. The plate, the year and the model do not change (a
// wrong one is switched off and a new car added), so that a booking's history stays true.
const never: Check<undefined> = (raw) => (raw === undefined ? { value: undefined } : { code: 'NOT_ALLOWED' });

export const updateVehicleSchema = z.object({
  updatedAt: versionField(),
  plate: field<undefined>(never),
  year: field<undefined>(never),
  modelSlug: field<undefined>(never),
  branchId: sent(branchId),
  active: sent(flag),
});

export const VEHICLE_SORT_FIELDS = ['plate', 'year', 'model', 'branch', 'createdAt'] as const;

const optionalChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

export const listVehicleSchema = z.object({
  ...pageFields,
  sort: sortField(VEHICLE_SORT_FIELDS, { field: 'plate', direction: 'asc' }),
  // A part of the plate, or of the model's name; case, spaces and Turkish letters do not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  // The model by its address, the branch by its id; one that does not exist simply finds nothing.
  model: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && SLUG.test(raw) && raw.length <= 60 ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  branch: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  status: optionalChoice(VEHICLE_STATUSES),
});
