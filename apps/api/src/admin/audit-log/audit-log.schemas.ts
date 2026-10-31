import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { isUuid } from '../../common/uuid.js';
import { pageFields } from '../admin-list.js';

// The input of the audit log list (V2-34, ADMIN.md §3.11). Field problems are the fixed codes of ADR-17. The log is read only and
// has one order (newest first), so there is no `sort`.

// A day as people write it, "2026-10-30", that is a real day.
const dayOnly = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { code: 'INVALID_FORMAT' };
  const [year, month, day] = raw.split('-').map(Number) as [number, number, number];
  const real = new Date(Date.UTC(year, month - 1, day));
  const same = real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day;
  return same && year >= 2000 && year <= 2100 ? { value: raw } : { code: 'INVALID_FORMAT' };
});

export const listAuditSchema = z.object({
  ...pageFields,
  // Who did it: an account id, or `cli` for what `pnpm admin:create` does.
  actor: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return raw === 'cli' || isUuid(raw) ? { value: raw as string } : { code: 'INVALID_FORMAT' };
  }),
  // What it was done to (`branch`, `reservation`, `user` ...): the name of a kind of record, as it is written to the log.
  entity: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  // The days it was done on, both included, by the Istanbul calendar.
  from: dayOnly,
  to: dayOnly,
});
