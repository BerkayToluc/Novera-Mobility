import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { normalizePromoCode } from '../reservations/reservation-input.js';
import { Audited } from './audit.interceptor.js';
import type { Page } from './admin-list.js';
import { PromoCodesService } from './promo-codes.service.js';
import type { PromoCodeView } from './promo-codes.view.js';

// The id an audit row names: the code from the address, written the way it is stored.
const codeParam = (request: Request): string | null => {
  const raw = request.params['code'];
  return typeof raw === 'string' ? (normalizePromoCode(raw) ?? raw) : null;
};

// Campaign codes (V2-26). Behind the administration guard like everything under `/admin`: no session 401, not an
// administrator 403. A code is not personal data, so its name is fine in the audit log.
@ApiTags('admin')
@Controller('admin/promo-codes')
export class PromoCodesController {
  constructor(private readonly codes: PromoCodesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<PromoCodeView>> {
    return this.codes.list(query);
  }

  @Post()
  @Audited({ action: 'promo-code.create', entity: 'promo-code', entityId: (_request, result) => (result as PromoCodeView).code })
  create(@Body() body: unknown): Promise<PromoCodeView> {
    return this.codes.create(body);
  }

  @Get(':code')
  get(@Param('code') code: string): Promise<PromoCodeView> {
    return this.codes.get(code);
  }

  @Patch(':code')
  @Audited({ action: 'promo-code.update', entity: 'promo-code', entityId: codeParam })
  update(@Param('code') code: string, @Body() body: unknown): Promise<PromoCodeView> {
    return this.codes.update(code, body);
  }

  @Delete(':code')
  @HttpCode(204)
  @Audited({ action: 'promo-code.delete', entity: 'promo-code', entityId: codeParam })
  remove(@Param('code') code: string): Promise<void> {
    return this.codes.remove(code);
  }
}
