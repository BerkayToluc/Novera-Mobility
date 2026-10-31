import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Page } from '../admin-list.js';
import { AuditLogService, type AuditEntryItem } from './audit-log.service.js';

// The audit log (V2-34): read only, so there is no other method. Behind the administration guard like everything under `/admin`.
@ApiTags('admin')
@Controller('admin/audit-log')
export class AuditLogController {
  constructor(private readonly log: AuditLogService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<AuditEntryItem>> {
    return this.log.list(query);
  }
}
