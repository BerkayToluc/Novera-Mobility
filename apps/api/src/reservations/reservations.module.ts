import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PricingService } from './pricing.service.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReservationsController],
  providers: [PricingService, ReservationsService],
  exports: [PricingService, ReservationsService],
})
export class ReservationsModule {}
