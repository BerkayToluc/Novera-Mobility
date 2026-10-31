import { Injectable } from '@nestjs/common';
import { istanbulDay } from '../common/time.js';
import { openWhere } from '../fleet/fleet-requests.service.js';
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
  // Contact messages nobody has marked handled (V2-32); those the retention task already erased do not count.
  unhandledMessages: number;
  // `null` until the screen that makes the number mean something exists (service requests, V2-41). The screen hides a `null`
  // card instead of showing a wrong zero.
  serviceRequests: number | null;
};

@Injectable()
export class AdminSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async get(now: Date = new Date()): Promise<AdminSummary> {
    const day = istanbulDay(now);
    const confirmed = { status: 'CONFIRMED' as const };
    const [rentalsStartingToday, rentalsEndingToday, reservationsLast7Days, quotesAwaiting, unhandledMessages, serviceRequests] = await Promise.all([
      this.prisma.reservation.count({ where: { ...confirmed, startAt: { gte: day.start, lt: day.end } } }),
      this.prisma.reservation.count({ where: { ...confirmed, endAt: { gte: day.start, lt: day.end } } }),
      this.prisma.reservation.count({ where: { ...confirmed, createdAt: { gte: day.weekStart, lt: day.end } } }),
      this.prisma.quoteRequest.count({ where: { status: 'RECEIVED' } }),
      // Messages nobody has marked handled. One whose personal fields were erased by the retention task has nothing left to
      // answer, so it is not waiting; the list opened by this card (`handled=false`) counts the same way.
      this.prisma.contactMessage.count({ where: { handledAt: null, anonymizedAt: null } }),
      // The service requests of the fleet customers that are not over yet (V2-41); the list opened by the card (`open=true`) counts the same way.
      this.prisma.serviceRequest.count({ where: openWhere(true) }),
    ]);
    return {
      date: day.date,
      rentalsStartingToday,
      rentalsEndingToday,
      reservationsLast7Days,
      quotesAwaiting,
      unhandledMessages,
      serviceRequests,
    };
  }
}
