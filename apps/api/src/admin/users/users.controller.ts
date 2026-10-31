import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { UsersService } from './users.service.js';
import type { UserDetail, UserListItem } from './users.view.js';

const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};

// Accounts (V2-34). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
// The id of the account is in the audit log; its e-mail address and name are not.
@ApiTags('admin')
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<UserListItem>> {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<UserDetail> {
    return this.users.get(id);
  }

  @Post(':id/disable')
  @HttpCode(200)
  @Audited({ action: 'user.disable', entity: 'user', entityId: idParam })
  disable(@Param('id') id: string): Promise<UserDetail> {
    return this.users.disable(id);
  }

  @Post(':id/enable')
  @HttpCode(200)
  @Audited({ action: 'user.enable', entity: 'user', entityId: idParam })
  enable(@Param('id') id: string): Promise<UserDetail> {
    return this.users.enable(id);
  }
}
