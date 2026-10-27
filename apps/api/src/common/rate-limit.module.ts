import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitCleaner } from './rate-limit.cleaner.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitService } from './rate-limit.service.js';
import { PrismaRateLimitStore, RateLimitStore } from './rate-limit.store.js';

// The rate limit for the whole API (ADR-27): imported once, by AppModule.
@Module({
  imports: [AuthModule],
  providers: [
    { provide: RateLimitStore, useClass: PrismaRateLimitStore },
    RateLimitService,
    RateLimitCleaner,
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
