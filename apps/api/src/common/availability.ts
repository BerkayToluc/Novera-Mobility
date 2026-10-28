import type { Db } from './db.js';

// When a vehicle cannot be booked (V2-13, QUALITY M-01): the same rule was written in the price check, the booking, the hold
// and the search. A period is half open, so a booking may start the moment another ends. What blocks it is a confirmed
// reservation, or a hold that has not expired.
export type Period = { startAt: Date; endAt: Date };

export const overlapping = ({ startAt, endAt }: Period) => ({ startAt: { lt: endAt }, endAt: { gt: startAt } });

export const blockingReservation = (period: Period) => ({ status: 'CONFIRMED' as const, ...overlapping(period) });

export const blockingHold = (period: Period, now: Date) => ({ expiresAt: { gt: now }, ...overlapping(period) });

// `ignoreHoldId` is the client's own hold: it does not stand in its own way.
export async function hasConflict(
  db: Db<'reservation' | 'hold'>,
  request: Period & { vehicleId: string },
  ignoreHoldId: string | null,
  now: Date,
): Promise<boolean> {
  const reservations = await db.reservation.count({ where: { vehicleId: request.vehicleId, ...blockingReservation(request) } });
  if (reservations > 0) return true;
  const holds = await db.hold.count({
    where: { vehicleId: request.vehicleId, ...blockingHold(request, now), ...(ignoreHoldId ? { id: { not: ignoreHoldId } } : {}) },
  });
  return holds > 0;
}
