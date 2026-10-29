import { Injectable } from '@nestjs/common';
import { istanbulDay } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';

// What the administration's first screen shows (ADMIN.md §3). Every count is one query; none reads a person's data.
export type AdminSummary = {
  // The Istanbul day the "today" numbers are for, so the screen can say which day it is showing.
  date: string;
  rentalsStartingToday: number;
  rentalsEndingToday: number;
  // Reservations made in the last seven Istanbul days (today and the six before), not counting cancelled ones.
  reservationsLast7Days: number;
  // Quote requests nobody has started on (`RECEIVED`).
  quotesAwaiting: number;
  // `null` until the screen that makes the number mean something exists: contact messages have no "handled" mark before
  // V2-32, service requests before V2-41. The screen hides a `null` card instead of showing a wrong zero.
  unhandledMessages: number | null;
  serviceRequests: number | null;
};

@Injectable()
export class AdminSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async get(now: Date = new Date()): Promise<AdminSummary> {
    const day = istanbulDay(now);
    const confirmed = { status: 'CONFIRMED' as const };
    const [rentalsStartingToday, rentalsEndingToday, reservationsLast7Days, quotesAwaiting] = await Promise.all([
      this.prisma.reservation.count({ where: { ...confirmed, startAt: { gte: day.start, lt: day.end } } }),
      this.prisma.reservation.count({ where: { ...confirmed, endAt: { gte: day.start, lt: day.end } } }),
      this.prisma.reservation.count({ where: { ...confirmed, createdAt: { gte: day.weekStart, lt: day.end } } }),
      this.prisma.quoteRequest.count({ where: { status: 'RECEIVED' } }),
    ]);
    return {
      date: day.date,
      rentalsStartingToday,
      rentalsEndingToday,
      reservationsLast7Days,
      quotesAwaiting,
      unhandledMessages: null,
      serviceRequests: null,
    };
  }
}
