import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { istanbulDateStart, istanbulDay } from '../../common/time.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { claimCancellation } from '../../reservations/cancellation.js';
import type { Page } from '../admin-list.js';
import { invalidTransition } from '../admin.errors.js';
import { cancelReservationSchema, listReservationSchema } from './reservations.schemas.js';
import {
  ADMIN_RESERVATION_INCLUDE,
  normalizeNumber,
  reservationDetail,
  reservationListItem,
  type AdminReservationRow,
  type ReservationDetail,
  type ReservationListItem,
} from './reservations.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Reservation not found' }, HttpStatus.NOT_FOUND);

// The bookings of the administration (V2-31, ADMIN.md §3.2). Unlike the small tables of the other screens, bookings keep growing,
// so the list is a database query: the filters, the order and the page are the database's, and a page costs one count and one
// read however many bookings there are.
@Injectable()
export class AdminReservationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown, now: Date = new Date()): Promise<Page<ReservationListItem>> {
    const input = parseInput(listReservationSchema, query, 'Reservation list query is invalid');
    if (input.from && input.to && input.from > input.to) {
      throw validationFailed({ to: 'INVALID_DATE_RANGE' }, 'The last day is before the first day');
    }

    // The windows of the summary cards (V2-25), counted the same way: the Istanbul day that holds `now`, and the seven days
    // that end with it.
    const day = istanbulDay(now);
    const where: Prisma.ReservationWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.branch ? { pickupBranchId: input.branch } : {}),
      // Every range is its own condition, so the days, "starts today" and the rest can be asked together.
      AND: [
        // The days a rental starts on, both included, by the Istanbul calendar: [start of `from`, start of the day after `to`).
        ...(input.from || input.to
          ? [
              {
                startAt: {
                  ...(input.from ? { gte: istanbulDateStart(input.from) } : {}),
                  ...(input.to ? { lt: istanbulDateStart(input.to, 1) } : {}),
                },
              },
            ]
          : []),
        ...(input.start ? [{ startAt: { gte: day.start, lt: day.end } }] : []),
        ...(input.end ? [{ endAt: { gte: day.start, lt: day.end } }] : []),
        ...(input.created ? [{ createdAt: { gte: day.weekStart, lt: day.end } }] : []),
      ],
      ...(input.q
        ? {
            OR: [
              { number: { contains: input.q, mode: 'insensitive' } },
              { user: { is: { email: { contains: input.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        include: ADMIN_RESERVATION_INCLUDE,
        // The id as the last key: bookings that share a start still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return {
      items: (rows as unknown as AdminReservationRow[]).map(reservationListItem),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async get(rawNumber: string, now: Date = new Date()): Promise<ReservationDetail> {
    return reservationDetail(await this.find(rawNumber), now);
  }

  // Cancelling from the panel is the customer's cancelling (one conditional update, `claimCancellation`) with the reason and the
  // administrator written on the booking, so the points, the car and the campaign code come out the same. A booking that has
  // started, or is already cancelled, is `409 INVALID_TRANSITION` and nothing is changed; a booking that is cancelled by the
  // customer at the same moment is cancelled once, and the slower of the two is told so.
  async cancel(rawNumber: string, body: unknown, adminId: string, now: Date = new Date()): Promise<ReservationDetail> {
    const number = this.numberOf(rawNumber);
    const input = parseInput(cancelReservationSchema, body, 'Cancellation validation failed');
    const current = await this.find(number);

    const claimed = await claimCancellation(this.prisma, { id: current.id }, now, { cancelReason: input.reason, cancelledById: adminId });
    if (!claimed) {
      // Read again: it may have been cancelled between the first read and the update.
      const latest = await this.find(number);
      throw invalidTransition(
        latest.status === 'CANCELLED' ? 'The booking is already cancelled' : 'The rental has already started, it can no longer be cancelled',
      );
    }
    return reservationDetail(await this.find(number), now);
  }

  // A number in the path, as it is stored: capitals. Something that cannot be a number is a booking that does not exist.
  private numberOf(raw: string): string {
    const number = normalizeNumber(raw);
    if (!number) throw notFound();
    return number;
  }

  private async find(rawNumber: string): Promise<AdminReservationRow> {
    // The number is checked first, before the database is touched.
    const number = this.numberOf(rawNumber);
    const row = await this.prisma.reservation.findUnique({ where: { number }, include: ADMIN_RESERVATION_INCLUDE });
    if (!row) throw notFound();
    return row as unknown as AdminReservationRow;
  }
}
