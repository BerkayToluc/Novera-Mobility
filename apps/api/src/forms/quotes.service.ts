import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { parseInput } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validationFailed } from '../common/zod-validation.js';
import { isSpam, spamDetected } from './form-input.js';
import { quoteSchema } from './forms.schemas.js';

// POST /quotes (BACKLOG #33, Y35, ADR-20): kurumsal teklif / görüşme talebi.
const NUMBER_ATTEMPTS = 10;

export interface QuoteReceived {
  received: true;
  referenceNumber: string;
}

// GET /me/quotes: one row of the account's own quote requests (contract: QuoteSummary).
export interface QuoteSummaryView {
  id: string;
  number: string;
  createdAt: string;
  vehicleCount: number;
  durationMonths: number;
  productSlug: string | null;
  status: 'RECEIVED' | 'IN_REVIEW' | 'OFFERED' | 'CLOSED';
}

// Numara yılı Türkiye saatine göre belirlenir (ADR-16).
function istanbulYear(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(date));
}

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: unknown, userId: string | null = null): Promise<QuoteReceived> {
    if (isSpam(input)) throw spamDetected();

    const {
      companyName,
      contactName,
      phone,
      email,
      vehicleCount,
      durationMonths,
      vehicleType,
      deliveryCities,
      notes,
      productSlug,
    } = parseInput(quoteSchema, input, 'Quote request validation failed');

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
      userId,
      kvkkConsentAt: new Date(),
    });
    return { received: true, referenceNumber };
  }

  // A renewal asked from the fleet panel (V2-38): the form is replaced by what the contract already knows, so the request is made here
  // from values that were checked by the caller. It lands in the administration's quote list like any other, marked `FLEET_RENEWAL`.
  async createFleetRenewal(data: {
    companyName: string;
    contactName: string;
    phone: string | null;
    email: string;
    vehicleCount: number;
    durationMonths: number;
    vehicleType: string;
    notes: string;
    productId: string;
    userId: string;
  }): Promise<QuoteReceived> {
    const referenceNumber = await this.createWithNumber({ ...data, deliveryCities: null, kvkkConsentAt: new Date(), source: 'FLEET_RENEWAL' });
    return { received: true, referenceNumber };
  }

  // GET /me/quotes: the signed-in account's own requests, newest first.
  async listMine(userId: string): Promise<QuoteSummaryView[]> {
    const rows = await this.prisma.quoteRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        createdAt: true,
        vehicleCount: true,
        durationMonths: true,
        status: true,
        product: { select: { slug: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      createdAt: row.createdAt.toISOString(),
      vehicleCount: row.vehicleCount,
      durationMonths: row.durationMonths,
      productSlug: row.product?.slug ?? null,
      status: row.status,
    }));
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
    userId: string | null;
    kvkkConsentAt: Date;
    source?: 'WEB' | 'FLEET_RENEWAL';
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
