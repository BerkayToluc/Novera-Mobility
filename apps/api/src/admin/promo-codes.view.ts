import type { PromoCode } from '../generated/prisma/client.js';

// What the administrator sees of a campaign code (V2-26, ADMIN.md §3.1): the stored fields plus how it is doing.
export const PROMO_STATUSES = ['ACTIVE', 'SCHEDULED', 'INACTIVE', 'EXPIRED', 'EXHAUSTED'] as const;
export type PromoCodeStatus = (typeof PROMO_STATUSES)[number];

export type PromoCodeView = {
  code: string;
  percent: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  oncePerUser: boolean;
  // Bookings that still hold the code (not cancelled); a cancelled booking gives it back (V2-05).
  used: number;
  // True when no booking, cancelled or not, ever carried the code: only then may it be deleted.
  deletable: boolean;
  status: PromoCodeStatus;
  createdAt: string;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
};

// How a code stands right now. One answer even when several things are true, in this order: switched off, past its end,
// used up, not started yet, working. `ends` is exclusive, the same as the check at booking time (`isPromoUsable`).
export function promoStatus(
  code: Pick<PromoCode, 'active' | 'validFrom' | 'validUntil' | 'maxRedemptions'>,
  used: number,
  now: Date,
): PromoCodeStatus {
  if (!code.active) return 'INACTIVE';
  if (code.validUntil && now.getTime() >= code.validUntil.getTime()) return 'EXPIRED';
  if (code.maxRedemptions !== null && used >= code.maxRedemptions) return 'EXHAUSTED';
  if (code.validFrom && now.getTime() < code.validFrom.getTime()) return 'SCHEDULED';
  return 'ACTIVE';
}

export type PromoUsage = { used: number; ever: number };
export const NO_USAGE: PromoUsage = { used: 0, ever: 0 };

export function promoCodeView(row: PromoCode, usage: PromoUsage, now: Date): PromoCodeView {
  return {
    code: row.code,
    percent: row.percent,
    active: row.active,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    maxRedemptions: row.maxRedemptions,
    oncePerUser: row.oncePerUser,
    used: usage.used,
    deletable: usage.ever === 0,
    status: promoStatus(row, usage.used, now),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
