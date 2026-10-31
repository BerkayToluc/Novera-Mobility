import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { isProvince } from '../../common/provinces.js';
import { email, phone, required, sent, text, versionField, type Check } from '../admin-fields.js';
import { pageFields, sortField } from '../admin-list.js';
import { BRANCH_KINDS, BRANCH_STATUSES, isValidDay, type OpeningHours } from './branches.view.js';

// The input of the branch endpoints (V2-27, ADMIN.md §3.1). Field problems are the fixed codes of ADR-17.

// Türkiye lies between about 36° and 42° north and 26° and 45° east; the box is a little wider than the country, so a
// point on the coast or the border is not refused. It catches the common slip (latitude and longitude swapped, a missing
// decimal point), not a point in the sea.
export const LATITUDE = { min: 35.5, max: 42.5 } as const;
export const LONGITUDE = { min: 25.5, max: 45.0 } as const;

const province: Check<string> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return typeof raw === 'string' && isProvince(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
};

const kind: Check<(typeof BRANCH_KINDS)[number]> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return typeof raw === 'string' && (BRANCH_KINDS as readonly string[]).includes(raw)
    ? { value: raw as (typeof BRANCH_KINDS)[number] }
    : { code: 'INVALID_FORMAT' };
};

const coordinate = (range: { min: number; max: number }): Check<number> => (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { code: 'INVALID_FORMAT' };
  return raw < range.min || raw > range.max ? { code: 'OUT_OF_RANGE' } : { value: raw };
};

// Three days, each `HH:MM-HH:MM` with the opening before the closing, or `closed`.
const openingHours: Check<OpeningHours> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { code: 'INVALID_FORMAT' };
  const days = raw as Record<string, unknown>;
  const result: Partial<OpeningHours> = {};
  for (const day of ['weekdays', 'saturday', 'sunday'] as const) {
    const value = days[day];
    if (typeof value !== 'string' || !isValidDay(value)) return { code: 'INVALID_FORMAT' };
    result[day] = value;
  }
  return { value: result as OpeningHours };
};

export const createBranchSchema = z.object({
  name: required(text(80)),
  city: required(province),
  address: required(text(200)),
  latitude: required(coordinate(LATITUDE)),
  longitude: required(coordinate(LONGITUDE)),
  phone: required(phone),
  email: required(email),
  kind: required(kind),
  openingHours: required(openingHours),
});

// A change names only what it changes, and always the version it was made against.
export const updateBranchSchema = z.object({
  updatedAt: versionField(),
  name: sent(text(80)),
  city: sent(province),
  address: sent(text(200)),
  latitude: sent(coordinate(LATITUDE)),
  longitude: sent(coordinate(LONGITUDE)),
  phone: sent(phone),
  email: sent(email),
  kind: sent(kind),
  openingHours: sent(openingHours),
});

export const BRANCH_SORT_FIELDS = ['name', 'city', 'activeVehicles', 'createdAt'] as const;

export const listBranchSchema = z.object({
  ...pageFields,
  sort: sortField(BRANCH_SORT_FIELDS, { field: 'name', direction: 'asc' }),
  // A part of the name, city or address; case and Turkish letters do not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  city: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && isProvince(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  status: field<(typeof BRANCH_STATUSES)[number] | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (BRANCH_STATUSES as readonly string[]).includes(raw)
      ? { value: raw as (typeof BRANCH_STATUSES)[number] }
      : { code: 'INVALID_FORMAT' };
  }),
});

