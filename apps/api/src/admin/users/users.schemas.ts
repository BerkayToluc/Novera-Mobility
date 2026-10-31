import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { pageFields, sortField } from '../admin-list.js';
import { USER_STATUSES, USER_TYPES } from './users.view.js';

// The input of the user list (V2-34, ADMIN.md §3.11). Field problems are the fixed codes of ADR-17.
export const USER_SORT_FIELDS = ['createdAt', 'email', 'lastName'] as const;

const optionalChoice = <T extends string>(values: readonly T[]) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
  });

export const listUserSchema = z.object({
  ...pageFields,
  sort: sortField(USER_SORT_FIELDS, { field: 'createdAt', direction: 'desc' }),
  // Parts of the e-mail address or of the name; every word has to be found in one of them, case does not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  type: optionalChoice(USER_TYPES),
  status: optionalChoice(USER_STATUSES),
});
