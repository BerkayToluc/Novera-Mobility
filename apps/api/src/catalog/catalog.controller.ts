import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get('branches')
  @ApiOkResponse({ description: 'Bayi listesi' })
  getBranches() {
    return this.catalogService.getBranches();
  }

  @Get('vehicle-models')
  @ApiQuery({ name: 'currency', required: false, enum: ['TRY', 'EUR', 'USD'] })
  @ApiOkResponse({ description: 'Model listesi' })
  getVehicleModels(@Query('currency') currency?: string) {
    return this.catalogService.getVehicleModels(currency);
  }

  @Get('vehicles')
  @ApiQuery({ name: 'pickupBranchId', required: true, type: String })
  @ApiQuery({ name: 'returnBranchId', required: true, type: String })
  @ApiQuery({ name: 'startAt', required: true, type: String })
  @ApiQuery({ name: 'endAt', required: true, type: String })
  @ApiQuery({ name: 'currency', required: false, enum: ['TRY', 'EUR', 'USD'] })
  @ApiOkResponse({ description: 'Müsait araçlar listesi' })
  getVehicles(
    @Query('pickupBranchId') pickupBranchId?: string,
    @Query('returnBranchId') returnBranchId?: string,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('currency') currency?: string,
  ) {
    return this.availability.getAvailableVehicles({
      pickupBranchId,
      returnBranchId,
      startAt,
      endAt,
      currency,
    });
  }

  @Get('extras')
  @ApiQuery({ name: 'currency', required: false, enum: ['TRY', 'EUR', 'USD'] })
  @ApiOkResponse({ description: 'Ek hizmet listesi' })
  getExtras(@Query('currency') currency?: string) {
    return this.catalogService.getExtras(currency);
  }

  @Get('rates')
  @ApiOkResponse({ description: 'Kurlar' })
  getRates() {
    return this.catalogService.getRates();
  }
}
