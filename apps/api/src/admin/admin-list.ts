import { field } from '../common/zod-fields.js';

// The list rules every `/admin/*` list shares (ADR-24): `?page=&pageSize=` (at most 100), `?sort=field:asc|desc`, and
// an answer of `{ items, total, page, pageSize }`. Written once here in V2-26, the first list, so the later ones
// (branches, models, reservations ...) do not each invent their own.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// A whole number in a query string, which always arrives as text. Missing is the fallback; anything else that is not
// plain digits is INVALID_FORMAT, and a number outside the range OUT_OF_RANGE.
const queryInteger = (fallback: number, min: number, max: number) =>
  field<number>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: fallback };
    if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return { code: 'INVALID_FORMAT' };
    const value = Number(raw);
    return value < min || value > max ? { code: 'OUT_OF_RANGE' } : { value };
  });

export const pageFields = {
  page: queryInteger(1, 1, 1_000_000),
  pageSize: queryInteger(DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
};

export type Sort<K extends string> = { field: K; direction: 'asc' | 'desc' };

// `field` or `field:asc` or `field:desc`, with the field from a fixed list; missing is the default order.
export const sortField = <K extends string>(allowed: readonly K[], fallback: Sort<K>) =>
  field<Sort<K>>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: fallback };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    const [name, direction = 'asc', ...rest] = raw.split(':');
    if (rest.length > 0 || (direction !== 'asc' && direction !== 'desc')) return { code: 'INVALID_FORMAT' };
    if (!(allowed as readonly string[]).includes(name ?? '')) return { code: 'INVALID_FORMAT' };
    return { value: { field: name as K, direction } };
  });

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

// One page of a list that was already filtered and sorted in memory (the lists of small, hand-managed tables).
export function pageOf<T>(all: readonly T[], page: number, pageSize: number): Page<T> {
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
}

// For searching by hand: lower case the Turkish way and without accents, so "sisli" finds "Şişli", "izmir" finds "İzmir" and
// "renault" finds "RENAULT". Both sides of a comparison go through it.
export function fold(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}
