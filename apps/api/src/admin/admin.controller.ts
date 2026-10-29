import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { optionalText } from '../common/zod-fields.js';
import { parseInput } from '../common/zod-validation.js';
import { CurrentUser } from '../auth/session.guard.js';
import type { UserRow } from '../auth/user-view.js';
import { AdminSummaryService, type AdminSummary } from './admin-summary.service.js';
import { Audited } from './audit.interceptor.js';

const pingSchema = z.object({ note: optionalText(200) });

// Everything here sits behind the administration guard (V2-23): no session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly summary: AdminSummaryService) {}

  // The first screen (V2-25). A read: it is not written to the audit log, which records changes.
  @Get('summary')
  getSummary(): Promise<AdminSummary> {
    return this.summary.get();
  }

  // Kept from V2-23: the way the guard and the audit log are proved by tests, with nothing real to change yet.
  @Get('ping')
  ping(@CurrentUser() user: UserRow): { ok: true; role: 'ADMIN' } {
    return { ok: true, role: user.role as 'ADMIN' };
  }

  @Post('ping')
  @HttpCode(204)
  @Audited({ action: 'admin.ping', entity: 'ping' })
  pingChange(@Body() body: unknown): void {
    parseInput(pingSchema, body, 'Ping data is invalid');
  }
}
