import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { AdminQuotesService } from './quotes.service.js';
import { normalizeQuoteNumber, type QuoteDetail, type QuoteListItem } from './quotes.view.js';

// The number of the request an audit row names: from the path, written the way it is stored. It is not personal data.
const numberParam = (request: Request): string | null => {
  const raw = request.params['number'];
  return typeof raw === 'string' ? normalizeQuoteNumber(raw) : null;
};

// Quote requests (V2-32). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin/quotes')
export class AdminQuotesController {
  constructor(private readonly quotes: AdminQuotesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<QuoteListItem>> {
    return this.quotes.list(query);
  }

  @Get(':number')
  get(@Param('number') number: string): Promise<QuoteDetail> {
    return this.quotes.get(number);
  }

  // The note is written on the request, not in the audit log: that keeps field names only.
  @Patch(':number')
  @Audited({ action: 'quote.update', entity: 'quote', entityId: numberParam })
  update(@Param('number') number: string, @Body() body: unknown): Promise<QuoteDetail> {
    return this.quotes.update(number, body);
  }
}
