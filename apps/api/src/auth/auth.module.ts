import { Module } from '@nestjs/common';
import { RateLimiter } from '../forms/rate-limiter.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MeController } from './me.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetService } from './password-reset.service.js';
import { ResetLinkNotifier } from './reset-link-notifier.js';
import { SessionGuard } from './session.guard.js';

// Protected endpoints elsewhere import this module and use `@UseGuards(SessionGuard)`.
// AuthService and PasswordResetService share one RateLimiter so their counters live in one place.
@Module({
  controllers: [AuthController, MeController, PasswordResetController],
  providers: [AuthService, PasswordResetService, ResetLinkNotifier, SessionGuard, RateLimiter],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}