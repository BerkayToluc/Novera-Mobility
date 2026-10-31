import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/session.guard.js';
import type { UserRow } from '../../auth/user-view.js';
import type { RequestDetail, RequestView } from '../../fleet/requests/request.view.js';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { AdminRequestsService } from './requests.service.js';

// What the audit rows name: the number of the request and the company it is for. Neither is personal data.
const numberParam = (request: Request): string | null => {
  const raw = request.params['number'];
  return typeof raw === 'string' ? raw.toUpperCase() : null;
};
const requestCompany = (_request: Request, result: unknown): string | null => (result as { company?: { id?: string } } | null)?.company?.id ?? null;

// The service requests (V2-41). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin/requests')
export class AdminRequestsController {
  constructor(private readonly requests: AdminRequestsService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<RequestView>> {
    return this.requests.list(query);
  }

  @Get(':number')
  get(@Param('number') number: string): Promise<RequestDetail> {
    return this.requests.get(number);
  }

  @Post(':number/status')
  @HttpCode(200)
  @Audited({ action: 'request.status', entity: 'request', entityId: numberParam, companyId: requestCompany })
  setStatus(@CurrentUser() admin: UserRow, @Param('number') number: string, @Body() body: unknown): Promise<RequestDetail> {
    return this.requests.setStatus(number, admin.id, body);
  }
}
