import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimiter } from '../forms/rate-limiter.js';
import { PricingService } from './pricing.service.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReservationsController],
  providers: [PricingService, ReservationsService, RateLimiter],
  exports: [PricingService, ReservationsService],
})
export class ReservationsModule {}