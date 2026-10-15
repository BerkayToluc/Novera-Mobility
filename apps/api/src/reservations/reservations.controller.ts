import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PricingService, type PriceBreakdown } from './pricing.service.js';

@ApiTags('reservations')
@Controller()
export class ReservationsController {
  constructor(@Inject(PricingService) private readonly pricing: PricingService) {}

  @Post('reservations/price')
  @HttpCode(200)
  @ApiBody({
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
  })
  @ApiOkResponse({ description: 'Fiyat dökümü (giriş gerekmez)' })
  price(@Body() body: unknown): Promise<PriceBreakdown> {
    return this.pricing.price(body);
  }
}
