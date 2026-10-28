import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { RatesUpdater } from './rates-updater.service.js';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, AvailabilityService, RatesUpdater],
  exports: [CatalogService, AvailabilityService],
})
export class CatalogModule {}
