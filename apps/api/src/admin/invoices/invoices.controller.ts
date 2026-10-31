import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { InvoiceView } from '../../fleet/invoice.view.js';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { InvoicesService, type GenerateResult } from './invoices.service.js';

// What the audit rows name: the period that was made, or the number of the invoice. Neither is personal data.
const periodQuery = (request: Request): string | null => {
  const raw = request.query['period'];
  return typeof raw === 'string' ? raw : null;
};
const numberParam = (request: Request): string | null => {
  const raw = request.params['number'];
  return typeof raw === 'string' ? raw.toUpperCase() : null;
};
const invoiceCompany = (_request: Request, result: unknown): string | null => (result as { company?: { id?: string } } | null)?.company?.id ?? null;

// Invoices (V2-37). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  // The month is in the query and there is no body: making the invoices is a decision, not an edit.
  @Post('generate')
  @HttpCode(200)
  @Audited({ action: 'invoice.generate', entity: 'invoice', entityId: periodQuery })
  generate(@Query() query: unknown): Promise<GenerateResult> {
    return this.invoices.generate(query);
  }

  @Get()
  list(@Query() query: unknown): Promise<Page<InvoiceView>> {
    return this.invoices.list(query);
  }

  @Get(':number')
  get(@Param('number') number: string): Promise<InvoiceView> {
    return this.invoices.get(number);
  }

  @Patch(':number')
  @Audited({ action: 'invoice.update', entity: 'invoice', entityId: numberParam, companyId: invoiceCompany })
  update(@Param('number') number: string, @Body() body: unknown): Promise<InvoiceView> {
    return this.invoices.update(number, body);
  }
}
