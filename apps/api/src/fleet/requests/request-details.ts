import { DAY_PATTERN, parseDay } from '../fleet-dates.js';
import type { RequestType } from './request-flow.js';

// The `details` of a service request, one shape for each kind (V2-41, ARCHITECTURE ADR-26, ADR-31, SPEC §3.D). The field codes are the fixed
// ones of ADR-17 and the field names are dotted under `details` (`details.location`), so a form can say which field is wrong.
export const INCIDENTS = ['BREAKDOWN', 'ACCIDENT', 'TIRE', 'FUEL_OR_CHARGE'] as const;
export const MAINTENANCE_SERVICES = ['PERIODIC', 'SUMMER_TIRES', 'WINTER_TIRES', 'INSPECTION'] as const;
export const MAX_ADDRESS = 200;
export const MAX_DESCRIPTION = 500;
export const MAX_RENTAL_DAYS = 90;
// How far ahead a day may be asked for: a year.
export const MAX_AHEAD_DAYS = 366;

export type Incident = (typeof INCIDENTS)[number];
export type MaintenanceService = (typeof MAINTENANCE_SERVICES)[number];

export type RoadsideDetails = { incident: Incident; location: { address: string | null; latitude: number | null; longitude: number | null }; description: string | null };
export type ReplacementDetails = { address: string; date: string; durationDays: number };
export type MaintenanceDetails = { service: MaintenanceService; preferredDate: string; valet: boolean; address: string | null };
export type RequestDetails = RoadsideDetails | ReplacementDetails | MaintenanceDetails;

type Errors = Record<string, string>;
type Parsed<T> = { value: T } | { errors: Errors };

const isObject = (raw: unknown): raw is Record<string, unknown> => raw !== null && typeof raw === 'object' && !Array.isArray(raw);

// Text, trimmed: not text is INVALID_FORMAT, too long TOO_LONG; empty is nothing (`null`) for an optional field and REQUIRED for a required one.
function text(raw: unknown, max: number, required: boolean): { value: string | null } | { code: string } {
  if (raw === undefined || raw === null) return required ? { code: 'REQUIRED' } : { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  const value = raw.trim();
  if (value === '') return required ? { code: 'REQUIRED' } : { value: null };
  return value.length > max ? { code: 'TOO_LONG' } : { value };
}

function choice<T extends string>(raw: unknown, values: readonly T[]): { value: T } | { code: string } {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? { value: raw as T } : { code: 'INVALID_FORMAT' };
}

// A calendar day from today (Istanbul) to a year ahead.
function day(raw: unknown, today: string): { value: string } | { code: string } {
  if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
  if (typeof raw !== 'string' || !DAY_PATTERN.test(raw) || !parseDay(raw)) return { code: 'INVALID_FORMAT' };
  const first = parseDay(today)!.getTime();
  const at = parseDay(raw)!.getTime();
  return at < first || at > first + MAX_AHEAD_DAYS * 86_400_000 ? { code: 'OUT_OF_RANGE' } : { value: raw };
}

function coordinate(raw: unknown, min: number, max: number): { value: number | null } | { code: string } {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { code: 'INVALID_FORMAT' };
  return raw < min || raw > max ? { code: 'OUT_OF_RANGE' } : { value: raw };
}

const failed = <T>(errors: Errors): Parsed<T> => ({ errors });

function roadside(raw: Record<string, unknown>): Parsed<RoadsideDetails> {
  const errors: Errors = {};
  const incident = choice(raw['incident'], INCIDENTS);
  if ('code' in incident) errors['details.incident'] = incident.code;
  const description = text(raw['description'], MAX_DESCRIPTION, false);
  if ('code' in description) errors['details.description'] = description.code;

  // Where the car is: an address, or a position from the phone ("use my location"), or both. At least one is needed.
  const place = isObject(raw['location']) ? raw['location'] : undefined;
  let location: RoadsideDetails['location'] = { address: null, latitude: null, longitude: null };
  if (!place) errors['details.location'] = raw['location'] === undefined || raw['location'] === null ? 'REQUIRED' : 'INVALID_FORMAT';
  else {
    const address = text(place['address'], MAX_ADDRESS, false);
    const latitude = coordinate(place['latitude'], -90, 90);
    const longitude = coordinate(place['longitude'], -180, 180);
    if ('code' in address) errors['details.location.address'] = address.code;
    if ('code' in latitude) errors['details.location.latitude'] = latitude.code;
    if ('code' in longitude) errors['details.location.longitude'] = longitude.code;
    if (!('code' in address) && !('code' in latitude) && !('code' in longitude)) {
      if ((latitude.value === null) !== (longitude.value === null)) errors['details.location'] = 'INVALID_FORMAT';
      else if (address.value === null && latitude.value === null) errors['details.location'] = 'REQUIRED';
      else location = { address: address.value, latitude: latitude.value, longitude: longitude.value };
    }
  }
  if (Object.keys(errors).length > 0) return failed(errors);
  return { value: { incident: (incident as { value: Incident }).value, location, description: (description as { value: string | null }).value } };
}

function replacement(raw: Record<string, unknown>, today: string): Parsed<ReplacementDetails> {
  const errors: Errors = {};
  const address = text(raw['address'], MAX_ADDRESS, true);
  const date = day(raw['date'], today);
  let durationDays = 0;
  const duration = raw['durationDays'];
  if (duration === undefined || duration === null || duration === '') errors['details.durationDays'] = 'REQUIRED';
  else if (typeof duration !== 'number' || !Number.isInteger(duration)) errors['details.durationDays'] = 'INVALID_FORMAT';
  else if (duration < 1 || duration > MAX_RENTAL_DAYS) errors['details.durationDays'] = 'OUT_OF_RANGE';
  else durationDays = duration;
  if ('code' in address) errors['details.address'] = address.code;
  if ('code' in date) errors['details.date'] = date.code;
  if (Object.keys(errors).length > 0) return failed(errors);
  return { value: { address: (address as { value: string }).value, date: (date as { value: string }).value, durationDays } };
}

function maintenance(raw: Record<string, unknown>, today: string): Parsed<MaintenanceDetails> {
  const errors: Errors = {};
  const service = choice(raw['service'], MAINTENANCE_SERVICES);
  const preferredDate = day(raw['preferredDate'], today);
  let valet = false;
  if (raw['valet'] === undefined || raw['valet'] === null) errors['details.valet'] = 'REQUIRED';
  else if (typeof raw['valet'] !== 'boolean') errors['details.valet'] = 'INVALID_FORMAT';
  else valet = raw['valet'];
  // Where the car is collected is needed when a valet comes for it.
  const address = text(raw['address'], MAX_ADDRESS, valet);
  if ('code' in service) errors['details.service'] = service.code;
  if ('code' in preferredDate) errors['details.preferredDate'] = preferredDate.code;
  if ('code' in address && !('details.valet' in errors)) errors['details.address'] = address.code;
  if (Object.keys(errors).length > 0) return failed(errors);
  return { value: { service: (service as { value: MaintenanceService }).value, preferredDate: (preferredDate as { value: string }).value, valet, address: valet ? (address as { value: string }).value : ((address as { value: string | null }).value ?? null) } };
}

// `details` of a request of this kind, or the fields that are wrong. A kind with no shape yet (a transfer, V2-42) has none to accept.
export function parseDetails(type: RequestType, raw: unknown, today: string): Parsed<RequestDetails> {
  if (!isObject(raw)) return failed({ details: raw === undefined || raw === null ? 'REQUIRED' : 'INVALID_FORMAT' });
  switch (type) {
    case 'ROADSIDE':
      return roadside(raw);
    case 'REPLACEMENT_VEHICLE':
      return replacement(raw, today);
    case 'MAINTENANCE':
      return maintenance(raw, today);
    default:
      return failed({ type: 'NOT_ALLOWED' });
  }
}
