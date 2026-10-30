import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isUuid } from '../../common/uuid.js';
import { parseInput } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { handleMessageSchema, listMessageSchema } from './messages.schemas.js';
import { MESSAGE_INCLUDE, messageDetail, messageListItem, type MessageDetail, type MessageListItem } from './messages.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Contact message not found' }, HttpStatus.NOT_FOUND);

// The contact messages of the administration (V2-32, ADMIN.md §3.2). They keep coming in, so the list is a database query.
@Injectable()
export class AdminMessagesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<MessageListItem>> {
    const input = parseInput(listMessageSchema, query, 'Message list query is invalid');
    const where: Prisma.ContactMessageWhereInput = {
      // The same counting as the summary card (`unhandledMessages`), so the card and the list it opens agree.
      ...(input.handled === false ? { handledAt: null, anonymizedAt: null } : {}),
      ...(input.handled === true ? { handledAt: { not: null } } : {}),
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: 'insensitive' } },
              { email: { contains: input.q, mode: 'insensitive' } },
              { subject: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({
        where,
        include: MESSAGE_INCLUDE,
        // The id as the last key, so messages that share a time still come in one order.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(messageListItem), total, page: input.page, pageSize: input.pageSize };
  }

  async get(id: string): Promise<MessageDetail> {
    return messageDetail(await this.find(id));
  }

  // The "handled" mark, and taking it back. Marking is idempotent: a message that is already handled keeps when and by whom it
  // was first marked. Taking it back clears both. Nothing here can fail for a repeated call, so there is no version to send.
  async handle(id: string, body: unknown, adminId: string, now: Date = new Date()): Promise<MessageDetail> {
    if (!isUuid(id)) throw notFound();
    const input = parseInput(handleMessageSchema, body, 'Contact message validation failed');
    const current = await this.find(id);

    if (input.handled) {
      if (current.handledAt) return messageDetail(current);
      // Only a message that is not marked yet is marked, so two administrators pressing together leave the first one's mark.
      await this.prisma.contactMessage.updateMany({ where: { id, handledAt: null }, data: { handledAt: now, handledById: adminId } });
    } else {
      await this.prisma.contactMessage.update({ where: { id }, data: { handledAt: null, handledById: null } });
    }
    return messageDetail(await this.find(id));
  }

  private async find(id: string) {
    // The id is checked first, before the database is touched: one that cannot be an id is a message that does not exist.
    if (!isUuid(id)) throw notFound();
    const row = await this.prisma.contactMessage.findUnique({ where: { id }, include: MESSAGE_INCLUDE });
    if (!row) throw notFound();
    return row;
  }
}
