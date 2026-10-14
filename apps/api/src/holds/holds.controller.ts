import { createHash } from 'node:crypto';
import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  HoldsService,
  type CreateHoldInput,
  type HoldResponse,
} from './holds.service.js';

// Hız sınırı için istemciyi tanır: IP adresinin özeti (hash). IP'nin kendisi saklanmaz.
// Tarayıcı Next üzerinden geldiği için gerçek adres X-Forwarded-For başlığındadır.
// Not: API'ye doğrudan erişilebiliyorsa bu başlık taklit edilebilir; güvenlik
// gözden geçirmesinde (BACKLOG #39) yeniden bakılacak.
function clientKeyOf(request: Request): string {
  const header = request.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header[0] : header;
  const forwarded = raw?.split(',')[0]?.trim();
  const address = forwarded || request.ip || 'unknown';
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}

@ApiTags('reservations')
@Controller()
export class HoldsController {
  constructor(private readonly holdsService: HoldsService) {}

  @Post('holds')
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
    @Body() body: CreateHoldInput,
    @Req() request: Request,
  ): Promise<HoldResponse> {
    return this.holdsService.create(body ?? {}, clientKeyOf(request));
  }
}
