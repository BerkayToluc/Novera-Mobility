import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, SessionGuard } from '../auth/session.guard.js';
import type { UserRow } from '../auth/user-view.js';
import { PricingService, type PriceBreakdown } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';

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
  ) {}

  @Post('reservations/price')
  @HttpCode(200)
  @ApiBody(RESERVATION_BODY)
  @ApiOkResponse({ description: 'Fiyat dökümü (giriş gerekmez)' })
  price(@Body() body: unknown): Promise<PriceBreakdown> {
    return this.pricing.price(body);
  }

  @Post('reservations')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiBody(RESERVATION_BODY)
  @ApiCreatedResponse({ description: 'Rezervasyon oluşturuldu (CONFIRMED)' })
  create(@CurrentUser() user: UserRow, @Body() body: unknown) {
    return this.reservations.create(user, body);
  }

  @Get('me/reservations')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Rezervasyonlarım, yeniden eskiye' })
  mine(@CurrentUser() user: UserRow) {
    return this.reservations.listMine(user.id);
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