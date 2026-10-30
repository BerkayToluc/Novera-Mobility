import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/session.guard.js';
import type { UserRow } from '../../auth/user-view.js';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { AdminMessagesService } from './messages.service.js';
import type { MessageDetail, MessageListItem } from './messages.view.js';

const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};

// Contact messages (V2-32). Behind the administration guard like everything under `/admin`: no session 401, not an administrator
// 403. The id of a message is in the audit log; what the person wrote is not.
@ApiTags('admin')
@Controller('admin/contact-messages')
export class AdminMessagesController {
  constructor(private readonly messages: AdminMessagesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<MessageListItem>> {
    return this.messages.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<MessageDetail> {
    return this.messages.get(id);
  }

  @Patch(':id')
  @Audited({ action: 'contact-message.handle', entity: 'contact-message', entityId: idParam })
  handle(@Param('id') id: string, @Body() body: unknown, @CurrentUser() admin: UserRow): Promise<MessageDetail> {
    return this.messages.handle(id, body, admin.id);
  }
}
