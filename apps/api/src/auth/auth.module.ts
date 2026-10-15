import { Module } from '@nestjs/common';
import { RateLimiter } from '../forms/rate-limiter.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MeController } from './me.controller.js';
import { SessionGuard } from './session.guard.js';

// Rezervasyon gibi korumalı uçlar bu modülü içe aktarıp `@UseGuards(SessionGuard)` kullanır.
@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, SessionGuard, RateLimiter],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
