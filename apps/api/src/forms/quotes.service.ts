import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FormReader,
  isSpam,
  rateLimited,
  spamDetected,
  validationFailed,
  type FormInput,
} from './form-input.js';
import { RateLimiter } from './rate-limiter.js';

// POST /quotes (BACKLOG #33, Y35, ADR-20): kurumsal teklif / görüşme talebi.
export const QUOTE_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const NUMBER_ATTEMPTS = 10;

export interface QuoteReceived {
  received: true;
  referenceNumber: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

// Numara yılı Türkiye saatine göre belirlenir (ADR-16).
function istanbulYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(date),
  );
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: RateLimiter,
  ) {}

  async create(input: FormInput, clientKey: string): Promise<QuoteReceived> {
    if (!this.limiter.allow(`quotes:${clientKey}`, QUOTE_LIMIT_PER_HOUR, HOUR_MS)) {
      throw rateLimited();
    }
    if (isSpam(input)) throw spamDetected();

    const form = new FormReader(input);
    const companyName = form.required('companyName', 160);
    const contactName = form.optional('contactName', 120);
    const phone = form.phone('phone');
    const email = form.email('email');
    const vehicleCount = form.integer('vehicleCount', 1, 10000);
    const durationMonths = form.integer('durationMonths', 1, 120);
    const vehicleType = form.required('vehicleType', 200);
    const deliveryCities = form.optional('deliveryCities', 240);
    const notes = form.optional('notes', 2000);
    const productSlug = form.optional('productSlug', 80);
    form.consent();
    form.assertValid('Quote request validation failed');

    // Ürün seçildiyse var olmalı; yanlış slug erken ve açık biçimde yakalanır.
    let productId: string | null = null;
    if (productSlug !== null) {
      const product = await this.prisma.product.findUnique({
        where: { slug: productSlug },
        select: { id: true },
      });
      if (!product) {
        throw validationFailed({ productSlug: 'UNKNOWN_REFERENCE' }, 'Product not found');
      }
      productId = product.id;
    }

    const referenceNumber = await this.createWithNumber({
      companyName,
      contactName,
      phone,
      email,
      vehicleCount,
      durationMonths,
      vehicleType,
      deliveryCities,
      notes,
      productId,
      kvkkConsentAt: new Date(),
    });
    return { received: true, referenceNumber };
  }

  // Numara yılın son numarasının bir fazlasıdır (TKL-2026-00042). İki istek aynı anda
  // aynı numarayı seçerse benzersizlik kısıtı ikincisini reddeder ve yeniden denenir.
  private async createWithNumber(data: {
    companyName: string;
    contactName: string | null;
    phone: string | null;
    email: string;
    vehicleCount: number;
    durationMonths: number;
    vehicleType: string;
    deliveryCities: string | null;
    notes: string | null;
    productId: string | null;
    kvkkConsentAt: Date;
  }): Promise<string> {
    const prefix = `TKL-${istanbulYear(new Date())}-`;
    for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt += 1) {
      const last = await this.prisma.quoteRequest.findFirst({
        where: { number: { startsWith: prefix } },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const lastSerial = last ? Number(last.number.slice(prefix.length)) : 0;
      const serial = (Number.isFinite(lastSerial) ? lastSerial : 0) + 1;
      const number = `${prefix}${String(serial).padStart(5, '0')}`;
      try {
        await this.prisma.quoteRequest.create({ data: { ...data, number } });
        return number;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new Error('Could not allocate a quote reference number');
  }
}
