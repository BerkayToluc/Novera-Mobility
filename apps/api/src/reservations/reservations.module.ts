import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { ReservationsController } from './reservations.controller.js';

@Module({
  controllers: [ReservationsController],
  providers: [PricingService],
  exports: [PricingService],
})
export class ReservationsModule {}
