import { parseInput } from '../common/zod-validation.js';
import { reservationRequestSchema } from './reservation.schemas.js';

// POST /reservations/price ve POST /reservations gövdesi (openapi.yaml ReservationRequest).
export type CurrencyCode = 'TRY' | 'EUR' | 'USD';
export const CURRENCY_CODES: readonly CurrencyCode[] = ['TRY', 'EUR', 'USD'];

export const MAX_EXTRA_QUANTITY = 10;
export const MAX_EXTRA_LINES = 20;
// Mantıklı bir üst sınır: bir yıldan uzun kiralama bu sitenin kapsamında değil.
export const MAX_RENTAL_DAYS = 365;

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
  // Pay part of the total with points (individual account, TRY only; checked where the account is known).
  usePoints: boolean;
  // A campaign code, normalized (upper case, no spaces); null when none was sent.
  promoCode: string | null;
}

// What a visitor typed, made comparable, the same way the web does it: no spaces, upper case, letters and
// digits only, 3 to 20 characters. Anything else is not a code at all.
export function normalizePromoCode(raw: string): string | null {
  const code = raw.trim().toLocaleUpperCase('en').replace(/\s+/g, '');
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : null;
}

export function isThirtyMinuteSlot(date: Date): boolean {
  const minutes = date.getUTCMinutes();
  return (minutes === 0 || minutes === 30) && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

export function parseReservationRequest(input: unknown, now: Date = new Date()): ValidReservationRequest {
  return parseInput(reservationRequestSchema(now), input, 'Reservation request validation failed');
}
