import 'reflect-metadata';
import { LIMITS } from '../common/rate-limits.js';
import { RATE_LIMIT_METADATA } from '../common/rate-limit.js';
import { JobsController } from './jobs.controller.js';
import type { RemindersService } from './reminders.service.js';

describe('the reminder trigger (V2-44)', () => {
  it('runs the reminders once per call and answers with what the run did', async () => {
    const summary = { due: 2, sent: 1, failed: 1, skipped: 0 };
    const run = jest.fn(async () => summary);
    const controller = new JobsController({ run } as unknown as RemindersService);
    expect(await controller.run()).toEqual(summary);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('sits under its own rate limit, 10 an hour by address', () => {
    const handler = Object.getOwnPropertyDescriptor(JobsController.prototype, 'run')!.value as object;
    expect(Reflect.getMetadata(RATE_LIMIT_METADATA, handler)).toEqual([LIMITS.jobs]);
    expect(LIMITS.jobs).toMatchObject({ limit: 10, windowSec: 3600, key: 'client' });
  });
});
