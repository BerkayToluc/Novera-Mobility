import { Inject, Injectable, Logger } from '@nestjs/common';
import { HOUR_MS } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';

// How long before the start of a rental the reminder goes (V2-44): the rental begins within the next 24 hours.
export const REMINDER_LEAD_MS = 24 * HOUR_MS;

export type ReminderRun = { due: number; sent: number; failed: number; skipped: number };

// The travel reminder (V2-44, docs/ARCHITECTURE.md ADR-32): a confirmed booking whose rental starts within 24 hours, for a person who has not
// turned the reminders off, once. "Once" is `reminderSentAt`: it is set by one conditional update BEFORE the e-mail goes out, so two runs at the same
// time, or an instance that starts again, cannot both send. If the delivery then fails the mark is taken off again, and the next run (the rental
// has not started) tries once more. A booking made less than 24 hours before the pickup is not reminded: the person has just been told by the
// confirmation.
@Injectable()
export class RemindersService {
  private readonly logger = new Logger('Reminders');

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async run(now: Date = new Date()): Promise<ReminderRun> {
    const result: ReminderRun = { due: 0, sent: 0, failed: 0, skipped: 0 };
    // With no mail provider nothing is marked: the day a provider is set, the rentals that are still ahead are reminded.
    if (!this.mail.enabled) return result;

    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        startAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
        reminderSentAt: null,
        user: { is: { notifyReminders: true, disabledAt: null } },
      },
      select: { id: true, startAt: true, createdAt: true },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });

    for (const booking of candidates) {
      if (booking.createdAt.getTime() > booking.startAt.getTime() - REMINDER_LEAD_MS) {
        result.skipped += 1;
        continue;
      }
      result.due += 1;
      const claimed = await this.prisma.reservation.updateMany({
        where: { id: booking.id, status: 'CONFIRMED', reminderSentAt: null, startAt: { gt: now } },
        data: { reminderSentAt: now },
      });
      // Someone else has it: not ours to send, and not a failure.
      if (claimed.count !== 1) continue;
      const sent = await this.notifications.sendReservation(booking.id, 'reminder').catch(() => false);
      if (sent) {
        result.sent += 1;
      } else {
        result.failed += 1;
        await this.prisma.reservation.updateMany({ where: { id: booking.id, reminderSentAt: now }, data: { reminderSentAt: null } });
      }
    }
    if (result.due > 0) this.logger.log(`Reminders: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  }
}
