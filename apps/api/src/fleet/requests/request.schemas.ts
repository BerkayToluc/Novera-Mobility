import { z } from 'zod';
import { required, text, type Check } from '../../admin/admin-fields.js';
import { pageFields, sortField } from '../../admin/admin-list.js';
import { isUuid } from '../../common/uuid.js';
import { field } from '../../common/zod-fields.js';
import { optional } from '../fleet.schemas.js';
import { REQUEST_STATUSES, REQUEST_TYPES, type RequestStatus, type RequestType } from './request-flow.js';

// The input of the service request endpoints, the customer's and the administrator's (V2-41, docs/FLEET.md §4). Field problems are the fixed
// codes of ADR-17.
const choice = <T extends string>(values: readonly T[]): Check<T> => (raw) => {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
};
const queryChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });
const uuidQuery = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
});
const flagQuery = field<boolean | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return raw === 'true' ? { value: true } : raw === 'false' ? { value: false } : { code: 'INVALID_FORMAT' };
});
const search = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
});

export const REQUEST_SORT_FIELDS = ['createdAt', 'updatedAt'] as const;

const listFields = {
  ...pageFields,
  sort: sortField(REQUEST_SORT_FIELDS, { field: 'createdAt', direction: 'desc' }),
  type: queryChoice(REQUEST_TYPES),
  status: queryChoice(REQUEST_STATUSES),
  // Not over yet (`true`) or over (`false`).
  open: flagQuery,
  vehicle: uuidQuery,
};
export const listFleetRequestSchema = z.object(listFields);
export const listAdminRequestSchema = z.object({ ...listFields, company: uuidQuery, q: search });

// A new request: the kind, the car (every kind but a transfer), and the `details` of that kind, which `parseDetails` reads.
export const createRequestSchema = z.object({
  type: required(choice<RequestType>(REQUEST_TYPES)),
  fleetVehicleId: field(optional(((raw) => {
    const result = text(60)(raw);
    return 'code' in result ? result : isUuid(result.value) ? result : { code: 'INVALID_FORMAT' };
  }) as Check<string>)),
  details: field<unknown>((raw) => ({ value: raw })),
});

// Novera moves a request: the step, a note for the timeline, and who is on it (free text; empty clears it, missing keeps it).
export const setRequestStatusSchema = z.object({
  status: required(choice<RequestStatus>(REQUEST_STATUSES)),
  note: field(optional(text(500))),
  assignee: field<string | null | undefined>((raw) => {
    if (raw === undefined) return { value: undefined };
    if (raw === null) return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    const value = raw.trim();
    return value.length > 200 ? { code: 'TOO_LONG' } : { value: value === '' ? null : value };
  }),
});
