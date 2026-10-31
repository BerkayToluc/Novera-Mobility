import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { CompaniesService } from './companies.service.js';
import type { CompanyDetail, CompanyListItem, CompanyUser } from './companies.view.js';

// The id of the company an audit row names: from the path. A company is not personal data; the people invited to it are, so their
// e-mail addresses and names are not in the log (only the field names are).
const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};

// Companies (V2-33). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin/companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<CompanyListItem>> {
    return this.companies.list(query);
  }

  @Post()
  @Audited({ action: 'company.create', entity: 'company', entityId: (_request, result) => (result as CompanyDetail).id })
  create(@Body() body: unknown): Promise<CompanyDetail> {
    return this.companies.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CompanyDetail> {
    return this.companies.get(id);
  }

  @Patch(':id')
  @Audited({ action: 'company.update', entity: 'company', entityId: idParam })
  update(@Param('id') id: string, @Body() body: unknown): Promise<CompanyDetail> {
    return this.companies.update(id, body);
  }

  @Post(':id/users')
  @Audited({ action: 'company.invite', entity: 'company', entityId: idParam })
  invite(@Param('id') id: string, @Body() body: unknown): Promise<CompanyUser> {
    return this.companies.invite(id, body);
  }

  // No body: sending the invitation again is a decision, not an edit, and the same call can be repeated.
  @Post(':id/users/:userId/resend')
  @HttpCode(200)
  @Audited({ action: 'company.invite-resend', entity: 'company', entityId: idParam })
  resend(@Param('id') id: string, @Param('userId') userId: string): Promise<CompanyUser> {
    return this.companies.resend(id, userId);
  }
}
