import { Inject, Injectable, Logger } from '@nestjs/common';
import { webBaseUrl } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  REQUEST_STATUS_WORDS,
  REQUEST_TYPE_WORDS,
  reservationCancelledEmail,
  reservationConfirmedEmail,
  reservationReminderEmail,
  requestStatusEmail,
  type Mail,
  type MailLocale,
  type ReservationMail,
} from './email-templates.js';
import { MailService } from './mail.service.js';

export type ReservationMailKind = 'confirmed' | 'cancelled' | 'reminder';

// The pages the e-mails link to, in the language of the person: Turkish has no prefix (the site's default), English has `/en`.
const termsUrl = (locale: MailLocale): string => (locale === 'EN' ? `${webBaseUrl()}/en/rental-terms` : `${webBaseUrl()}/kiralama-kosullari`);
const requestUrl = (number: string, locale: MailLocale): string => (locale === 'EN' ? `${webBaseUrl()}/en/my-fleet/requests/${number}` : `${webBaseUrl()}/filom/talepler/${number}`);

// What the site tells a person by e-mail about their bookings and requests (V2-44, docs/ARCHITECTURE.md ADR-32). The callers (the
// booking, the cancellation, the administrator's moves) only say that something happened, by id; this reads what the e-mail needs and sends it
// after the caller has finished, **without being waited for and without ever throwing**: a mail provider that is down, or a person whose
// account is gone, changes nothing about the answer to the request that caused it.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  // Fire and forget.
  reservationConfirmed(id: string): void {
    this.track(this.sendReservation(id, 'confirmed'));
  }

  reservationCancelled(id: string): void {
    this.track(this.sendReservation(id, 'cancelled'));
  }

  requestStatusChanged(number: string): void {
    this.track(this.sendRequestStatus(number));
  }

  // The deliveries still on their way; a test waits for them, a server never needs to.
  async idle(): Promise<void> {
    await Promise.allSettled(this.pending);
  }

  private track(work: Promise<unknown>): void {
    const done: Promise<unknown> = work
      .catch((error: unknown) => this.logger.error(`An e-mail could not be prepared: ${error instanceof Error ? error.name : 'unknown error'}`))
      .finally(() => this.pending.delete(done));
    this.pending.add(done);
  }

  // Whether the e-mail went out. Nothing is sent to a booking with no account, to an account that has been closed, or for a booking that is not in
  // the state the e-mail talks about (a confirmation of one that was cancelled in the meantime, say).
  async sendReservation(id: string, kind: ReservationMailKind): Promise<boolean> {
    if (!this.mail.enabled) return false;
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        number: true,
        status: true,
        startAt: true,
        endAt: true,
        totalPrice: true,
        currency: true,
        user: { select: { email: true, firstName: true, locale: true, disabledAt: true } },
        vehicle: { select: { vehicleModel: { select: { brand: true, model: true } } } },
        pickupBranch: { select: { name: true, city: true } },
        returnBranch: { select: { name: true, city: true } },
      },
    });
    if (!row?.user || row.user.disabledAt) return false;
    if ((kind === 'cancelled') !== (row.status === 'CANCELLED')) return false;

    const locale: MailLocale = row.user.locale;
    const data: ReservationMail = {
      firstName: row.user.firstName,
      number: row.number,
      vehicle: `${row.vehicle.vehicleModel.brand} ${row.vehicle.vehicleModel.model}`,
      pickup: `${row.pickupBranch.name}, ${row.pickupBranch.city}`,
      dropoff: `${row.returnBranch.name}, ${row.returnBranch.city}`,
      startAt: row.startAt,
      endAt: row.endAt,
      total: row.totalPrice,
      currency: row.currency,
      termsUrl: termsUrl(locale),
    };
    const mail: Mail = kind === 'confirmed' ? reservationConfirmedEmail(data, locale) : kind === 'cancelled' ? reservationCancelledEmail(data, locale) : reservationReminderEmail(data, locale);
    return this.mail.send(row.user.email, mail, `booking-${kind}`);
  }

  // To the person who opened the request, when it moves to another step. A request opened by an account that has since gone has no one to tell.
  async sendRequestStatus(number: string): Promise<boolean> {
    if (!this.mail.enabled) return false;
    const row = await this.prisma.serviceRequest.findUnique({
      where: { number },
      select: {
        number: true,
        type: true,
        status: true,
        vehicle: { select: { plate: true } },
        createdBy: { select: { email: true, firstName: true, locale: true, disabledAt: true } },
      },
    });
    if (!row?.createdBy || row.createdBy.disabledAt) return false;
    const locale: MailLocale = row.createdBy.locale;
    const mail = requestStatusEmail(
      { firstName: row.createdBy.firstName, number: row.number, type: REQUEST_TYPE_WORDS[locale][row.type], status: REQUEST_STATUS_WORDS[locale][row.status], plate: row.vehicle?.plate ?? null, url: requestUrl(row.number, locale) },
      locale,
    );
    return this.mail.send(row.createdBy.email, mail, 'request-status');
  }
}
