import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FormReader,
  isSpam,
  rateLimited,
  spamDetected,
  type FormInput,
} from './form-input.js';
import { RateLimiter } from './rate-limiter.js';

// POST /contact (BACKLOG Y34, ADR-20): iletişim formu yalnızca veritabanına yazılır.
// Aynı istemciden saatte en fazla bu kadar istek kabul edilir (geçersiz olanlar dahil).
export const CONTACT_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: RateLimiter,
  ) {}

  async create(input: FormInput, clientKey: string): Promise<{ received: true }> {
    if (!this.limiter.allow(`contact:${clientKey}`, CONTACT_LIMIT_PER_HOUR, HOUR_MS)) {
      throw rateLimited();
    }
    if (isSpam(input)) throw spamDetected();

    const form = new FormReader(input);
    const name = form.required('name', 120);
    const email = form.email('email');
    const phone = form.phone('phone');
    const subject = form.required('subject', 160);
    const message = form.required('message', 4000);
    form.consent();
    form.assertValid('Contact form validation failed');

    await this.prisma.contactMessage.create({
      data: { name, email, phone, subject, message, kvkkConsentAt: new Date() },
    });
    return { received: true };
  }
}
