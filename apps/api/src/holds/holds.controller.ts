import { Body, Controller, Delete, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { clientKeyOf } from '../common/client-key.js';
import { RateLimit } from '../common/rate-limit.js';
import { LIMITS } from '../common/rate-limits.js';
import {
  HoldsService,
  type HoldResponse,
} from './holds.service.js';

@ApiTags('reservations')
@Controller()
export class HoldsController {
  constructor(private readonly holdsService: HoldsService) {}

  @Post('holds')
  @RateLimit(LIMITS.holds)
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'vehicleId',
        'pickupBranchId',
        'returnBranchId',
        'startAt',
        'endAt',
      ],
      properties: {
        vehicleId: { type: 'string', format: 'uuid' },
        pickupBranchId: { type: 'string', format: 'uuid' },
        returnBranchId: { type: 'string', format: 'uuid' },
        startAt: { type: 'string', format: 'date-time' },
        endAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Araç 15 dakika tutuldu',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        vehicleId: { type: 'string', format: 'uuid' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  create(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<HoldResponse> {
    return this.holdsService.create(body, clientKeyOf(request));
  }

  @Delete('holds/:id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Tutma bırakıldı (olmayan ya da süresi dolmuş tutmada da 204)' })
  release(@Param('id') id: string, @Req() request: Request): Promise<void> {
    return this.holdsService.release(id, clientKeyOf(request));
  }
}
