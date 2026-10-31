import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { isTestRun } from '../config/env.js';
import { HOUR_MS } from '../common/time.js';
import { RemindersService } from './reminders.service.js';

// Hourly while the instance is warm (V2-44), and once at each start: the same pattern as the other background tasks. Cloud Run scales to zero
// and slows the process down between requests, so this alone is not a clock; the reliable trigger is `POST /jobs/reminders`, called every hour by
// Cloud Scheduler (docs/DEPLOY.md). Every run is safe to repeat (`reminderSentAt`).
@Injectable()
export class RemindersTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersTask.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(RemindersService) private readonly reminders: RemindersService) {}

  onModuleInit(): void {
    // Tests never start a background task.
    if (isTestRun()) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    try {
      await this.reminders.run();
    } catch (error) {
      this.logger.error(`The reminder run failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
