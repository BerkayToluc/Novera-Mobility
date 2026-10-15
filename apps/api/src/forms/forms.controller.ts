import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ContactService } from './contact.service.js';
import { asFormInput } from './form-input.js';
import { QuotesService, type QuoteReceived } from './quotes.service.js';
import { clientKeyOf } from './rate-limiter.js';

@ApiTags('forms')
@Controller()
export class FormsController {
  constructor(
    private readonly contactService: ContactService,
    private readonly quotesService: QuotesService,
  ) {}

  @Post('contact')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'subject', 'message', 'consent'],
      properties: {
        name: { type: 'string', maxLength: 120 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', nullable: true, maxLength: 30 },
        subject: { type: 'string', maxLength: 160 },
        message: { type: 'string', maxLength: 4000 },
        consent: { type: 'boolean' },
        website: { type: 'string', description: 'Tuzak alan. Boş olmalı.' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Mesaj alındı' })
  contact(@Body() body: unknown, @Req() request: Request): Promise<{ received: true }> {
    return this.contactService.create(asFormInput(body), clientKeyOf(request));
  }

  @Post('quotes')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['companyName', 'vehicleCount', 'durationMonths', 'vehicleType', 'email', 'consent'],
      properties: {
        companyName: { type: 'string', maxLength: 160 },
        contactName: { type: 'string', nullable: true, maxLength: 120 },
        phone: { type: 'string', nullable: true, maxLength: 30 },
        email: { type: 'string', format: 'email' },
        vehicleCount: { type: 'integer', minimum: 1, maximum: 10000 },
        durationMonths: { type: 'integer', minimum: 1, maximum: 120 },
        vehicleType: { type: 'string', maxLength: 200 },
        deliveryCities: { type: 'string', nullable: true, maxLength: 240 },
        notes: { type: 'string', nullable: true, maxLength: 2000 },
        productSlug: { type: 'string', nullable: true },
        consent: { type: 'boolean' },
        website: { type: 'string', description: 'Tuzak alan. Boş olmalı.' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Talep alındı, talep numarası döner' })
  quote(@Body() body: unknown, @Req() request: Request): Promise<QuoteReceived> {
    return this.quotesService.create(asFormInput(body), clientKeyOf(request));
  }
}
