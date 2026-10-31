import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LIMITS } from '../common/rate-limits.js';
import { RateLimit } from '../common/rate-limit.js';
import { RemindersService, type ReminderRun } from './reminders.service.js';

// The hourly trigger of the travel reminders (V2-44, docs/DEPLOY.md): Cloud Scheduler calls it, because a Cloud Run instance that is asleep runs
// no timer. In production the API is reachable only with the web server's key (common/api-access.ts), which the scheduler sends too; the call
// is waited for, so the work is done while the request holds the CPU. It takes no input and is safe to repeat: a reminder is sent once.
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly reminders: RemindersService) {}

  @Post('reminders')
  @HttpCode(200)
  @RateLimit(LIMITS.jobs)
  run(): Promise<ReminderRun> {
    return this.reminders.run();
  }
}
