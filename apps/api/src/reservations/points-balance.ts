import type { PrismaService } from '../prisma/prisma.service.js';

// The points ledger of one account (SPEC §2.9). Earned points reach the balance when the rental ends
// (`pending` before that); points spent on a reservation leave the balance at once and come back if
// that reservation is cancelled (a cancelled reservation is simply not counted).
export type LedgerDb = Pick<PrismaService, 'pointTransaction' | 'reservation'>;

export interface PointsHistoryEntry {
  points: number;
  reservationNumber: string | null;
  createdAt: string;
}

export interface PointsLedger {
  balance: number;
  pending: number;
  history: PointsHistoryEntry[];
}

export async function loadPointsLedger(db: LedgerDb, userId: string, now: Date): Promise<PointsLedger> {
  const earned = await db.pointTransaction.findMany({
    where: { userId },
    include: { reservation: { select: { number: true, status: true, startAt: true, endAt: true, createdAt: true } } },
  });
  const spentRows = await db.reservation.findMany({
    where: { userId, status: 'CONFIRMED', pointsUsed: { gt: 0 } },
    select: { number: true, pointsUsed: true, createdAt: true },
  });

  let credited = 0;
  let pending = 0;
  const history: PointsHistoryEntry[] = [];
  for (const row of earned) {
    const reservation = row.reservation;
    if (reservation && reservation.status !== 'CONFIRMED') continue;
    // Rows booked after their own start (made before the start-time check existed) never pay out.
    if (reservation && reservation.createdAt.getTime() >= reservation.startAt.getTime()) continue;
    const creditedAt = reservation ? reservation.endAt : row.createdAt;
    if (creditedAt.getTime() > now.getTime()) {
      pending += row.points;
    } else {
      credited += row.points;
      history.push({
        points: row.points,
        reservationNumber: reservation?.number ?? null,
        createdAt: creditedAt.toISOString(),
      });
    }
  }

  let spent = 0;
  for (const row of spentRows) {
    spent += row.pointsUsed;
    history.push({
      points: -row.pointsUsed,
      reservationNumber: row.number,
      createdAt: row.createdAt.toISOString(),
    });
  }

  history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { balance: credited - spent, pending, history };
}
