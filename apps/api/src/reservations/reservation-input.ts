import { validationFailed } from '../forms/form-input.js';

// POST /reservations/price ve POST /reservations gövdesi (openapi.yaml ReservationRequest).
export type CurrencyCode = 'TRY' | 'EUR' | 'USD';
export const CURRENCY_CODES: readonly CurrencyCode[] = ['TRY', 'EUR', 'USD'];

export const MAX_EXTRA_QUANTITY = 10;
export const MAX_EXTRA_LINES = 20;
// Mantıklı bir üst sınır: bir yıldan uzun kiralama bu sitenin kapsamında değil.
export const MAX_RENTAL_DAYS = 365;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExtraSelection {
  slug: string;
  quantity: number;
}

export interface ValidReservationRequest {
  vehicleId: string;
  holdId: string | null;
  pickupBranchId: string;
  returnBranchId: string;
  startAt: Date;
  endAt: Date;
  currency: CurrencyCode;
  extras: ExtraSelection[];
}

export function isThirtyMinuteSlot(date: Date): boolean {
  const minutes = date.getUTCMinutes();
  return (
    (minutes === 0 || minutes === 30) &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

export function parseReservationRequest(input: unknown): ValidReservationRequest {
  const body: Record<string, unknown> =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};

  const uuid = (name: string, required: boolean): string | null => {
    const value = body[name];
    if (value === undefined || value === null || value === '') {
      if (required) errors[name] = 'REQUIRED';
      return null;
    }
    if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
      errors[name] = 'INVALID_FORMAT';
      return null;
    }
    return value;
  };

  const date = (name: string): Date | null => {
    const value = body[name];
    if (value === undefined || value === null || value === '') {
      errors[name] = 'REQUIRED';
      return null;
    }
    const parsed = typeof value === 'string' ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      errors[name] = 'INVALID_FORMAT';
      return null;
    }
    if (!isThirtyMinuteSlot(parsed)) {
      errors[name] = 'NOT_IN_SLOT';
      return null;
    }
    return parsed;
  };

  const vehicleId = uuid('vehicleId', true);
  const holdId = uuid('holdId', false);
  const pickupBranchId = uuid('pickupBranchId', true);
  const returnBranchId = uuid('returnBranchId', true);
  const startAt = date('startAt');
  const endAt = date('endAt');

  if (startAt && endAt) {
    if (endAt.getTime() <= startAt.getTime()) {
      errors.endAt = 'INVALID_DATE_RANGE';
    } else if (endAt.getTime() - startAt.getTime() > MAX_RENTAL_DAYS * 86_400_000) {
      errors.endAt = 'OUT_OF_RANGE';
    }
  }

  let currency: CurrencyCode = 'TRY';
  const rawCurrency = body.currency;
  if (rawCurrency === undefined || rawCurrency === null || rawCurrency === '') {
    errors.currency = 'REQUIRED';
  } else if (!CURRENCY_CODES.includes(rawCurrency as CurrencyCode)) {
    errors.currency = 'INVALID_FORMAT';
  } else {
    currency = rawCurrency as CurrencyCode;
  }

  const extras = parseExtras(body.extras, errors);

  if (
    Object.keys(errors).length > 0 ||
    !vehicleId ||
    !pickupBranchId ||
    !returnBranchId ||
    !startAt ||
    !endAt
  ) {
    throw validationFailed(errors, 'Reservation request validation failed');
  }

  return { vehicleId, holdId, pickupBranchId, returnBranchId, startAt, endAt, currency, extras };
}

function parseExtras(raw: unknown, errors: Record<string, string>): ExtraSelection[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.extras = 'INVALID_FORMAT';
    return [];
  }
  if (raw.length > MAX_EXTRA_LINES) {
    errors.extras = 'TOO_LONG';
    return [];
  }
  const seen = new Set<string>();
  const result: ExtraSelection[] = [];
  for (const item of raw as unknown[]) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.extras = 'INVALID_FORMAT';
      return [];
    }
    const { slug, quantity } = item as Record<string, unknown>;
    if (typeof slug !== 'string' || slug.trim() === '' || slug.length > 80) {
      errors.extras = 'INVALID_FORMAT';
      return [];
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
      errors.extras = 'INVALID_FORMAT';
      return [];
    }
    if (quantity < 1 || quantity > MAX_EXTRA_QUANTITY) {
      errors.extras = 'OUT_OF_RANGE';
      return [];
    }
    if (seen.has(slug)) {
      errors.extras = 'INVALID_FORMAT'; // aynı hizmet iki kez gönderilmez
      return [];
    }
    seen.add(slug);
    result.push({ slug, quantity });
  }
  return result;
}
