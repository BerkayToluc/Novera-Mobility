import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { UserRow } from '../../auth/user-view.js';
import { CurrentUser } from '../../auth/session.guard.js';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { AdminReservationsService } from './reservations.service.js';
import { normalizeNumber, type ReservationDetail, type ReservationListItem } from './reservations.view.js';

// The number of the booking an audit row names: from the path, written the way it is stored. A booking number is not personal data.
const numberParam = (request: Request): string | null => {
  const raw = request.params['number'];
  return typeof raw === 'string' ? normalizeNumber(raw) : null;
};

// Bookings (V2-31). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin/reservations')
export class AdminReservationsController {
  constructor(private readonly reservations: AdminReservationsService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<ReservationListItem>> {
    return this.reservations.list(query);
  }

  @Get(':number')
  get(@Param('number') number: string): Promise<ReservationDetail> {
    return this.reservations.get(number);
  }

  // The reason is written on the booking, not in the audit log: that keeps field names only.
  @Post(':number/cancel')
  @HttpCode(200)
  @Audited({ action: 'reservation.cancel', entity: 'reservation', entityId: numberParam })
  cancel(@Param('number') number: string, @Body() body: unknown, @CurrentUser() admin: UserRow): Promise<ReservationDetail> {
    return this.reservations.cancel(number, body, admin.id);
  }
}
