import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { VehiclesService } from './vehicles.service.js';
import type { VehicleUsage, VehicleView } from './vehicles.view.js';

const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};

// Vehicles (V2-30). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403. A
// car's plate is not personal data, but the audit row names the car by its id anyway, and the fields by name only.
@ApiTags('admin')
@Controller('admin/vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<VehicleView>> {
    return this.vehicles.list(query);
  }

  @Post()
  @Audited({ action: 'vehicle.create', entity: 'vehicle', entityId: (_request, result) => (result as VehicleView).id })
  create(@Body() body: unknown): Promise<VehicleView> {
    return this.vehicles.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<VehicleView & { usage: VehicleUsage }> {
    return this.vehicles.get(id);
  }

  @Patch(':id')
  @Audited({ action: 'vehicle.update', entity: 'vehicle', entityId: idParam })
  update(@Param('id') id: string, @Body() body: unknown): Promise<VehicleView> {
    return this.vehicles.update(id, body);
  }
}
