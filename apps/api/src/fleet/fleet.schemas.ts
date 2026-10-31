import { z } from 'zod';
import { email, phone, required, sent, text, versionField, type Check } from '../admin/admin-fields.js';
import { pageFields, sortField } from '../admin/admin-list.js';
import { istanbulDateStart } from '../common/time.js';
import { isUuid } from '../common/uuid.js';
import { field } from '../common/zod-fields.js';
import { DAY_PATTERN, parseDay } from './fleet-dates.js';

// The input of the fleet endpoints (V2-35, docs/FLEET.md §4.1). Field problems are the fixed codes of ADR-17.

// A field that may be left out: empty is "nothing" (`null`), anything else goes through the check.
export const optional =
  <T>(check: Check<T>): Check<T | null> =>
  (raw) => {
    if (raw === undefined || raw === null) return { value: null };
    if (typeof raw === 'string' && raw.trim() === '') return { value: null };
    return check(raw);
  };

const query = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

const search = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
});

const uuidQuery = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
});

// "true" or "false" as a query string says it.
const flagQuery = field<boolean | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return raw === 'true' ? { value: true } : raw === 'false' ? { value: false } : { code: 'INVALID_FORMAT' };
});

// ---------- Vehicles ----------
export const VEHICLE_SORT_FIELDS = ['plate', 'year', 'createdAt'] as const;
export const listFleetVehicleSchema = z.object({
  ...pageFields,
  sort: sortField(VEHICLE_SORT_FIELDS, { field: 'plate', direction: 'asc' }),
  // A part of the plate or of the model's name; case and spaces do not matter.
  q: search,
  status: query(['ACTIVE', 'RETURNED'] as const),
  assigned: flagQuery,
  contract: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && /^SZL-\d{4}-\d{5,}$/i.test(raw.trim()) ? { value: raw.trim().toUpperCase() } : { code: 'INVALID_FORMAT' };
  }),
});

// ---------- Contracts ----------
export const CONTRACT_SORT_FIELDS = ['endAt', 'startAt', 'number'] as const;
export const listFleetContractSchema = z.object({
  ...pageFields,
  sort: sortField(CONTRACT_SORT_FIELDS, { field: 'endAt', direction: 'asc' }),
  status: query(['ACTIVE', 'ENDED'] as const),
});

// ---------- Employees ----------
const name = (max: number): Check<string> => text(max);
export const MAX_EMPLOYEE_NAME = 60;

export const createEmployeeSchema = z.object({
  firstName: required(name(MAX_EMPLOYEE_NAME)),
  lastName: required(name(MAX_EMPLOYEE_NAME)),
  department: field(optional(text(60))),
  employeeNo: field(optional(text(30))),
  email: field(optional(email)),
  phone: field(optional(phone)),
});

// A change names the version it was made against and only what it changes. To clear an optional field, send it empty. `active: false`
// is how a person leaves: nothing is deleted, and an assignment still open is ended (FLEET.md §3).
const flag: Check<boolean> = (raw) => {
  if (raw === undefined || raw === null) return { code: 'REQUIRED' };
  return typeof raw === 'boolean' ? { value: raw } : { code: 'INVALID_FORMAT' };
};
export const updateEmployeeSchema = z.object({
  updatedAt: versionField(),
  firstName: sent(name(MAX_EMPLOYEE_NAME)),
  lastName: sent(name(MAX_EMPLOYEE_NAME)),
  department: sent(optional(text(60))),
  employeeNo: sent(optional(text(30))),
  email: sent(optional(email)),
  phone: sent(optional(phone)),
  active: sent(flag),
});

export const EMPLOYEE_SORT_FIELDS = ['lastName', 'createdAt'] as const;
export const listEmployeeSchema = z.object({
  ...pageFields,
  sort: sortField(EMPLOYEE_SORT_FIELDS, { field: 'lastName', direction: 'asc' }),
  // Parts of the name, the department or the sicil no; every word has to be found, case does not matter.
  q: search,
  active: flagQuery,
});

// ---------- Assignments ----------
export const MAX_NOTE = 200;

// A moment as people give it: a full date-time ("2026-10-31T09:30:00Z") or a day ("2026-10-31", from 00:00 Istanbul). Missing is
// "now"; whether it is not in the future is the service's to say (it has the clock).
export const instant: Check<Date | null> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  if (DAY_PATTERN.test(raw)) return parseDay(raw) ? { value: istanbulDateStart(raw) } : { code: 'INVALID_FORMAT' };
  const date = new Date(raw);
  return /^\d{4}-\d{2}-\d{2}T/.test(raw) && !Number.isNaN(date.getTime()) ? { value: date } : { code: 'INVALID_FORMAT' };
};

const id: Check<string> = (raw) => {
  const result = text(60)(raw);
  return 'code' in result ? result : isUuid(result.value) ? result : { code: 'INVALID_FORMAT' };
};

export const createAssignmentSchema = z.object({
  fleetVehicleId: required(id),
  employeeId: required(id),
  startedAt: field(instant),
  note: field(optional(text(MAX_NOTE))),
});

export const endAssignmentSchema = z.object({ endedAt: field(instant) });

export const listAssignmentSchema = z.object({
  ...pageFields,
  vehicle: uuidQuery,
  employee: uuidQuery,
  open: flagQuery,
});
