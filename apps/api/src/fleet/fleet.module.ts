import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { FormsModule } from '../forms/forms.module.js';
import { CompanyGuard } from './company.guard.js';
import { FleetAssignmentsService } from './fleet-assignments.service.js';
import { FleetContractsService } from './fleet-contracts.service.js';
import { FleetEmployeesService } from './fleet-employees.service.js';
import { FleetExpensesService } from './fleet-expenses.service.js';
import { FleetInvoicesService } from './fleet-invoices.service.js';
import { FleetReportsService } from './fleet-reports.service.js';
import { FleetSummaryService } from './fleet-summary.service.js';
import { FleetVehiclesService } from './fleet-vehicles.service.js';
import {
  FleetAssignmentsController,
  FleetContractsController,
  FleetEmployeesController,
  FleetExpensesController,
  FleetInvoicesController,
  FleetReportsController,
  FleetSummaryController,
  FleetVehiclesController,
} from './fleet.controllers.js';

// The fleet panel's API (V2-35, ADR-25): `/fleet/*` behind `CompanyGuard`, a global guard so a controller added here later cannot forget
// it. Imported after the rate limit module, like the administration, so a request is counted before it is turned away. The audit log is
// written by the administration's interceptor, which covers `/fleet/*` writes as well.
@Module({
  imports: [AuthModule, FormsModule],
  controllers: [FleetSummaryController, FleetVehiclesController, FleetContractsController, FleetEmployeesController, FleetAssignmentsController, FleetInvoicesController, FleetExpensesController, FleetReportsController],
  providers: [
    FleetSummaryService,
    FleetVehiclesService,
    FleetContractsService,
    FleetEmployeesService,
    FleetAssignmentsService,
    FleetInvoicesService,
    FleetExpensesService,
    FleetReportsService,
    { provide: APP_GUARD, useClass: CompanyGuard },
  ],
})
export class FleetModule {}
