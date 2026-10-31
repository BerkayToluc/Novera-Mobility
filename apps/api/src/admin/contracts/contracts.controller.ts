import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { ContractDetail, ContractView, FleetVehicleView, ReadingView } from '../../fleet/fleet.view.js';
import { Audited } from '../audit.interceptor.js';
import { AdminContractsService } from './contracts.service.js';

// What the audit rows name: the number of the contract, or the id of the car; and the company where the path has it. None of it is
// personal data.
const numberParam = (request: Request): string | null => {
  const raw = request.params['number'];
  return typeof raw === 'string' ? raw.toUpperCase() : null;
};
const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};
const companyParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};
const contractCompany = (_request: Request, result: unknown): string | null => (result as { company?: { id?: string } } | null)?.company?.id ?? null;

// Contracts, fleet cars and readings (V2-35, docs/FLEET.md §4.2). Behind the administration guard like everything under `/admin`: no
// session 401, not an administrator 403.
@ApiTags('admin')
@Controller('admin')
export class AdminContractsController {
  constructor(private readonly contracts: AdminContractsService) {}

  @Get('companies/:id/contracts')
  list(@Param('id') id: string): Promise<{ items: ContractView[] }> {
    return this.contracts.listForCompany(id);
  }

  @Post('companies/:id/contracts')
  @Audited({ action: 'contract.create', entity: 'contract', entityId: (_request, result) => (result as ContractView).number, companyId: companyParam })
  create(@Param('id') id: string, @Body() body: unknown): Promise<ContractView> {
    return this.contracts.create(id, body);
  }

  @Get('contracts/:number')
  get(@Param('number') number: string): Promise<ContractDetail> {
    return this.contracts.get(number);
  }

  @Patch('contracts/:number')
  @Audited({ action: 'contract.update', entity: 'contract', entityId: numberParam, companyId: contractCompany })
  update(@Param('number') number: string, @Body() body: unknown): Promise<ContractView> {
    return this.contracts.update(number, body);
  }

  @Post('contracts/:number/vehicles')
  @Audited({ action: 'fleet-vehicle.create', entity: 'fleet-vehicle', entityId: (_request, result) => (result as FleetVehicleView).id })
  createVehicle(@Param('number') number: string, @Body() body: unknown): Promise<FleetVehicleView> {
    return this.contracts.createVehicle(number, body);
  }

  @Patch('fleet-vehicles/:id')
  @Audited({ action: 'fleet-vehicle.update', entity: 'fleet-vehicle', entityId: idParam })
  updateVehicle(@Param('id') id: string, @Body() body: unknown): Promise<FleetVehicleView> {
    return this.contracts.updateVehicle(id, body);
  }

  @Post('fleet-vehicles/:id/readings')
  @Audited({ action: 'fleet-vehicle.reading', entity: 'fleet-vehicle', entityId: idParam })
  addReading(@Param('id') id: string, @Body() body: unknown): Promise<ReadingView> {
    return this.contracts.addReading(id, body);
  }
}
