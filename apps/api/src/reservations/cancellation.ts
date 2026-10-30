import type { Prisma } from '../generated/prisma/client.js';
import type { Db } from '../common/db.js';

// The one way a booking is cancelled, whoever asks (V2-31): the customer from "Rezervasyonlarım" and an administrator from the
// panel. It is a single conditional update, so two cancellations at once cannot both win, and one that races the start of the
// rental loses to it: only a confirmed booking that has not started is cancelled. It says whether this call did it.
//
// What follows from the status is not written here, it is worked out from it, which is why both ways give the same result: the
// car is free again at once (a clash only looks at CONFIRMED), the points that were spent count as returned and the points that
// were pending are gone (the ledger skips what is cancelled), and the campaign code is free again (its uses are counted from
// CONFIRMED bookings).
export async function claimCancellation(
  db: Db<'reservation'>,
  where: Prisma.ReservationWhereInput,
  now: Date,
  by: { cancelReason: string; cancelledById: string } | null = null,
): Promise<boolean> {
  const claimed = await db.reservation.updateMany({
    where: { ...where, status: 'CONFIRMED', startAt: { gt: now } },
    data: { status: 'CANCELLED', cancelledAt: now, ...by },
  });
  return claimed.count === 1;
}
