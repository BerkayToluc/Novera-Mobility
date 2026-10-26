import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUser, SessionGuard } from '../auth/session.guard.js';
import { SESSION_COOKIE, readCookie } from '../auth/session-token.js';
import type { UserRow } from '../auth/user-view.js';
import { ContactService } from './contact.service.js';
import { QuotesService, type QuoteReceived, type QuoteSummaryView } from './quotes.service.js';
import { RateLimit } from '../common/rate-limit.js';
import { LIMITS } from '../common/rate-limits.js';

@ApiTags('forms')
@Controller()
export class FormsController {
  constructor(
    @Inject(ContactService) private readonly contactService: ContactService,
    @Inject(QuotesService) private readonly quotesService: QuotesService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('contact')
  @RateLimit(LIMITS.contact)
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
  contact(@Body() body: unknown): Promise<{ received: true }> {
    return this.contactService.create(body);
  }

  @Post('quotes')
  @RateLimit(LIMITS.quotes)
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
  async quote(@Body() body: unknown, @Req() request: Request): Promise<QuoteReceived> {
    // Visitors may send a request; when a session is present the request is linked to the account.
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const user = token ? await this.auth.authenticate(token) : null;
    return this.quotesService.create(body, user?.id ?? null);
  }

  @Get('me/quotes')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Hesabın kendi teklif talepleri, yeniden eskiye' })
  mine(@CurrentUser() user: UserRow): Promise<QuoteSummaryView[]> {
    return this.quotesService.listMine(user.id);
  }
}