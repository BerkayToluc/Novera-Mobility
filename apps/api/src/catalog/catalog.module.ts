import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { RatesUpdater } from './rates-updater.service.js';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, RatesUpdater],
  exports: [CatalogService],
})
export class CatalogModule {}