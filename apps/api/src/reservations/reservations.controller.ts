import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { rateLimited } from '../forms/form-input.js';
import { RateLimiter, clientKeyOf } from '../forms/rate-limiter.js';
import { CurrentUser, SessionGuard } from '../auth/session.guard.js';
import { SESSION_COOKIE, readCookie } from '../auth/session-token.js';
import type { UserRow } from '../auth/user-view.js';
import { PricingService, type PriceBreakdown } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';

// POST /reservations/price is open to anyone, POST /reservations takes no payment: both are limited (SECURITY.md).
export const PRICE_LIMIT_PER_10_MIN = 60;
export const CREATE_LIMIT_PER_HOUR = 10;
// A request that carries a campaign code is how codes are guessed, so those get a much tighter limit (QUALITY G-04).
export const PROMO_PRICE_LIMIT_PER_10_MIN = 10;
const TEN_MINUTES_MS = 10 * 60_000;
const HOUR_MS = 60 * 60_000;

function carriesPromoCode(body: unknown): boolean {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
  const code = (body as { promoCode?: unknown }).promoCode;
  return typeof code === 'string' && code.trim() !== '';
}

const RESERVATION_BODY = {
  schema: {
    type: 'object',
    required: ['vehicleId', 'pickupBranchId', 'returnBranchId', 'startAt', 'endAt', 'currency'],
    properties: {
      vehicleId: { type: 'string', format: 'uuid' },
      holdId: { type: 'string', format: 'uuid', nullable: true },
      pickupBranchId: { type: 'string', format: 'uuid' },
      returnBranchId: { type: 'string', format: 'uuid' },
      startAt: { type: 'string', format: 'date-time' },
      endAt: { type: 'string', format: 'date-time' },
      currency: { type: 'string', enum: ['TRY', 'EUR', 'USD'] },
      usePoints: { type: 'boolean', description: 'Puanla öde (bireysel hesap, yalnızca TL)' },
      promoCode: { type: 'string', nullable: true, description: 'Kampanya kodu (büyük/küçük harf fark etmez)' },
      extras: {
        type: 'array',
        items: {
          type: 'object',
          required: ['slug', 'quantity'],
          properties: {
            slug: { type: 'string' },
            quantity: { type: 'integer', minimum: 1, maximum: 10 },
          },
        },
      },
    },
  },
};

@ApiTags('reservations')
@Controller()
export class ReservationsController {
  constructor(
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(ReservationsService) private readonly reservations: ReservationsService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  @Post('reservations/price')
  @HttpCode(200)
  @ApiBody(RESERVATION_BODY)
  @ApiOkResponse({ description: 'Fiyat dökümü (giriş gerekmez)' })
  async price(@Body() body: unknown, @Req() request: Request): Promise<PriceBreakdown> {
    if (!this.limiter.allow(`price:${clientKeyOf(request)}`, PRICE_LIMIT_PER_10_MIN, TEN_MINUTES_MS)) {
      throw rateLimited();
    }
    if (carriesPromoCode(body) && !this.limiter.allow(`promo:${clientKeyOf(request)}`, PROMO_PRICE_LIMIT_PER_10_MIN, TEN_MINUTES_MS)) {
      throw rateLimited();
    }
    // Open to visitors; the session is only read when the price is asked with `usePoints`.
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const user = token ? await this.auth.authenticate(token) : null;
    return this.pricing.price(body, user);
  }

  @Post('reservations')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiBody(RESERVATION_BODY)
  @ApiCreatedResponse({ description: 'Rezervasyon oluşturuldu (CONFIRMED)' })
  create(@CurrentUser() user: UserRow, @Body() body: unknown, @Req() request: Request) {
    if (!this.limiter.allow(`reserve:${user.id}`, CREATE_LIMIT_PER_HOUR, HOUR_MS)) throw rateLimited();
    return this.reservations.create(user, body, clientKeyOf(request));
  }

  @Get('me/reservations')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Rezervasyonlarım, yeniden eskiye' })
  mine(@CurrentUser() user: UserRow) {
    return this.reservations.listMine(user.id);
  }

  @Get('me/reservations/:id')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Tek rezervasyon (yalnızca kendi rezervasyonu)' })
  one(@CurrentUser() user: UserRow, @Param('id') id: string) {
    return this.reservations.getMine(user.id, id);
  }

  @Post('me/reservations/:id/cancel')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'İptal edilen rezervasyon (status CANCELLED)' })
  cancel(@CurrentUser() user: UserRow, @Param('id') id: string) {
    return this.reservations.cancel(user.id, id);
  }

  @Get('me/points')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Puan bakiyesi, bekleyen puan, geçmiş ve kural metni' })
  points(@CurrentUser() user: UserRow) {
    return this.reservations.points(user.id);
  }
}