import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DAY_MS } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { erasedContactFields, erasedQuoteFields, retentionCutoff } from './retention.js';

// Once a day (V2-12, QUALITY V-07): contact messages and quote requests older than the retention period lose their
// personal fields; the rows stay for the figures. Same pattern as the other background tasks: it runs at each start and
// every 24 hours while the instance is warm (Cloud Run scales to zero), and each run is safe to repeat.
const EVERY_MS = DAY_MS;

@Injectable()
export class RetentionTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionTask.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Tests never start a background task.
    if (process.env.NODE_ENV === 'test') return;
    void this.run();
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // Returns how many rows of each kind were anonymised.
  async run(now: Date = new Date()): Promise<{ contactMessages: number; quoteRequests: number }> {
    const expired = { createdAt: { lt: retentionCutoff(now) }, anonymizedAt: null };
    try {
      const contactMessages = await this.prisma.contactMessage.updateMany({ where: expired, data: erasedContactFields(now) });
      const quoteRequests = await this.prisma.quoteRequest.updateMany({ where: expired, data: erasedQuoteFields(now) });
      if (contactMessages.count + quoteRequests.count > 0) {
        this.logger.log(`Retention: ${contactMessages.count} messages and ${quoteRequests.count} quote requests anonymised`);
      }
      return { contactMessages: contactMessages.count, quoteRequests: quoteRequests.count };
    } catch (error) {
      this.logger.warn(`Retention task failed: ${(error as Error).message}`);
      return { contactMessages: 0, quoteRequests: 0 };
    }
  }
}
