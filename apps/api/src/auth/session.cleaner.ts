import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DAY_MS } from '../common/time.js';
import { isTestRun } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SESSION_IDLE_DAYS } from './session-token.js';

// Once a day (V2-10, QUALITY G-13 and V-06): the sessions that ended (expired, or unused for the idle time), the
// password reset links that expired or were used, and the sign-in wait rows nobody touched for a day. Until now
// they were only deleted when that person signed in again. Like the other background tasks it runs at each start
// and every 24 hours while the instance is warm (Cloud Run scales to zero), which is enough here.
const EVERY_MS = DAY_MS;

@Injectable()
export class SessionCleaner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleaner.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Tests never start a background task.
    if (isTestRun()) return;
    void this.clean();
    this.timer = setInterval(() => void this.clean(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // Returns how many rows of each kind were deleted.
  async clean(now: Date = new Date()): Promise<{ sessions: number; resetTokens: number; loginThrottles: number }> {
    try {
      const sessions = await this.prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: now } },
            { lastUsedAt: { lt: new Date(now.getTime() - SESSION_IDLE_DAYS * DAY_MS) } },
          ],
        },
      });
      const resetTokens = await this.prisma.passwordResetToken.deleteMany({
        where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] },
      });
      const loginThrottles = await this.prisma.loginThrottle.deleteMany({
        where: { updatedAt: { lt: new Date(now.getTime() - DAY_MS) } },
      });
      return { sessions: sessions.count, resetTokens: resetTokens.count, loginThrottles: loginThrottles.count };
    } catch (error) {
      this.logger.warn(`Session cleanup failed: ${(error as Error).message}`);
      return { sessions: 0, resetTokens: 0, loginThrottles: 0 };
    }
  }
}
