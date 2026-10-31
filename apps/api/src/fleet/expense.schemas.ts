import { z } from 'zod';
import { required, sent, text, versionField, type Check } from '../admin/admin-fields.js';
import { pageFields, sortField } from '../admin/admin-list.js';
import { normalizePlate } from '../admin/vehicles/vehicles.view.js';
import { isUuid } from '../common/uuid.js';
import { field } from '../common/zod-fields.js';
import { EXPENSE_STATUSES, EXPENSE_TYPES, MAX_EXPENSE_AMOUNT, type ExpenseStatus, type ExpenseType } from './expense-calc.js';
import { parseDay } from './fleet-dates.js';
import { instant, optional } from './fleet.schemas.js';

// The input of the expense endpoints, the customer's and the administrator's (V2-38, docs/FLEET.md §4). Field problems are the fixed codes
// of ADR-17.

const choice = <T extends string>(values: readonly T[]): Check<T> => (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
};

// A query string value that may be left out.
const queryChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

const queryUuid = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
});

// A calendar day in a query, "2026-10-31", kept as the text.
const queryDay = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return typeof raw === 'string' && parseDay(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
});

export const queryText = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
});

// The amount, TRY kuruş: a whole number of at least one kuruş.
const amount: Check<number> = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
  return raw < 1 || raw > MAX_EXPENSE_AMOUNT ? { code: 'OUT_OF_RANGE' } : { value: raw };
};

// When it happened: a full date-time or a day. There is no "now" for an expense: someone has to say.
const when: Check<Date> = (raw) => {
  const result = instant(raw);
  if ('code' in result) return result;
  return result.value === null ? { code: 'REQUIRED' } : { value: result.value };
};

// The plate as it is stored; that a car of a fleet has it is the service's to say (UNKNOWN_REFERENCE).
const plate: Check<string> = (raw) => {
  const result = text(30)(raw);
  if ('code' in result) return result;
  const normal = normalizePlate(result.value);
  return normal ? { value: normal } : { code: 'INVALID_FORMAT' };
};

export const MAX_EXPENSE_DESCRIPTION = 200;
export const MAX_EXPENSE_PLACE = 100;

// The fields an expense is written with, by the administrator (a new one) and again by the administrator (a correction).
const typeCheck = choice<ExpenseType>(EXPENSE_TYPES);

export const EXPENSE_SORT_FIELDS = ['occurredAt', 'amount'] as const;

// The filters the customer's list and the administrator's list share. `employee` is a person's id, or `none` for the expenses of a
// moment nobody had the car.
const employeeQuery = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return raw === 'none' || isUuid(raw) ? { value: raw as string } : { code: 'INVALID_FORMAT' };
});

const sharedListFields = {
  ...pageFields,
  sort: sortField(EXPENSE_SORT_FIELDS, { field: 'occurredAt', direction: 'desc' }),
  type: queryChoice(EXPENSE_TYPES),
  status: queryChoice(EXPENSE_STATUSES),
  vehicle: queryUuid,
  // From the first day to the last day, both included, Istanbul days.
  from: queryDay,
  to: queryDay,
};

export const listFleetExpenseSchema = z.object({ ...sharedListFields, employee: employeeQuery });

export const listAdminExpenseSchema = z.object({
  ...sharedListFields,
  company: queryUuid,
  // A part of the plate; case and spaces do not matter.
  q: queryText,
});

export const createExpenseSchema = z.object({
  plate: required(plate),
  type: required(typeCheck),
  occurredAt: required(when),
  amount: required(amount),
  description: field(optional(text(MAX_EXPENSE_DESCRIPTION))),
  place: field(optional(text(MAX_EXPENSE_PLACE))),
});

// A correction names the version it was made against and only what it changes. The car does not change: a cost on the wrong car is
// entered again.
export const updateExpenseSchema = z.object({
  updatedAt: versionField(),
  type: sent(typeCheck),
  occurredAt: sent(when),
  amount: sent(amount),
  description: sent(optional(text(MAX_EXPENSE_DESCRIPTION))),
  place: sent(optional(text(MAX_EXPENSE_PLACE))),
});

// What the customer changes: only the state.
export const setExpenseStatusSchema = z.object({ updatedAt: versionField(), status: required(choice<ExpenseStatus>(EXPENSE_STATUSES)) });

export const MAX_REFLECT_IDS = 100;
const ids: Check<string[]> = (raw) => {
  if (raw === undefined || raw === null) return { code: 'REQUIRED' };
  if (!Array.isArray(raw)) return { code: 'INVALID_FORMAT' };
  if (raw.length === 0) return { code: 'REQUIRED' };
  if (raw.length > MAX_REFLECT_IDS) return { code: 'TOO_LONG' };
  if (!raw.every((id) => typeof id === 'string' && isUuid(id))) return { code: 'INVALID_FORMAT' };
  return { value: [...new Set(raw as string[])] };
};
export const reflectExpensesSchema = z.object({ ids: required(ids) });
