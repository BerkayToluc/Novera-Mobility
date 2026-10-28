import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { isTestRun } from '../config/env.js';
import { RateLimitStore } from './rate-limit.store.js';
import { DAY_MS } from './time.js';

// Old windows are of no use: the longest one is an hour. Once a day the ones older than a day go (ADR-27).
const EVERY_MS = DAY_MS;
const KEEP_MS = DAY_MS;

@Injectable()
export class RateLimitCleaner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitCleaner.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(RateLimitStore) private readonly store: RateLimitStore) {}

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

  async clean(now: Date = new Date()): Promise<number> {
    try {
      return await this.store.deleteBefore(new Date(now.getTime() - KEEP_MS));
    } catch (error) {
      this.logger.warn(`Rate limit cleanup failed: ${(error as Error).message}`);
      return 0;
    }
  }
}
