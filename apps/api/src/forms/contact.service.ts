import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseInput } from '../common/zod-validation.js';
import { isSpam, spamDetected } from './form-input.js';
import { contactSchema } from './forms.schemas.js';

// POST /contact (BACKLOG Y34, ADR-20): iletişim formu yalnızca veritabanına yazılır.

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: unknown): Promise<{ received: true }> {
    if (isSpam(input)) throw spamDetected();

    const { name, email, phone, subject, message } = parseInput(contactSchema, input, 'Contact form validation failed');

    await this.prisma.contactMessage.create({
      data: { name, email, phone, subject, message, kvkkConsentAt: new Date() },
    });
    return { received: true };
  }
}
