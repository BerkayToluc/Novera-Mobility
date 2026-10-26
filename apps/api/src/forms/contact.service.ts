import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseInput } from '../common/zod-validation.js';
import { isSpam, rateLimited, spamDetected } from './form-input.js';
import { contactSchema } from './forms.schemas.js';
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

  async create(input: unknown, clientKey: string): Promise<{ received: true }> {
    if (!this.limiter.allow(`contact:${clientKey}`, CONTACT_LIMIT_PER_HOUR, HOUR_MS)) {
      throw rateLimited();
    }
    if (isSpam(input)) throw spamDetected();

    // After the limit and the trap, as before: the limit counts invalid requests too.
    const { name, email, phone, subject, message } = parseInput(contactSchema, input, 'Contact form validation failed');

    await this.prisma.contactMessage.create({
      data: { name, email, phone, subject, message, kvkkConsentAt: new Date() },
    });
    return { received: true };
  }
}
