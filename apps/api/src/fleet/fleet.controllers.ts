import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Page } from '../admin/admin-list.js';
import { Audited } from '../admin/audit.interceptor.js';
import type { UserRow } from '../auth/user-view.js';
import { CurrentUser } from '../auth/session.guard.js';
import type { QuoteReceived } from '../forms/quotes.service.js';
import { CurrentCompany } from './company.guard.js';
import { FleetAssignmentsService } from './fleet-assignments.service.js';
import { FleetContractsService } from './fleet-contracts.service.js';
import { FleetEmployeesService } from './fleet-employees.service.js';
import { FleetExpensesService, type ReflectResult } from './fleet-expenses.service.js';
import type { ExpenseView } from './expense.view.js';
import { FleetInvoicesService } from './fleet-invoices.service.js';
import type { InvoiceView } from './invoice.view.js';
import { FleetReportsService } from './fleet-reports.service.js';
import type { Report } from './report-calc.js';
import { FleetSummaryService, type FleetSummary } from './fleet-summary.service.js';
import { FleetVehiclesService, type FleetVehicleDetail } from './fleet-vehicles.service.js';
import type { AssignmentView, ContractDetail, ContractView, EmployeeView, FleetVehicleView } from './fleet.view.js';

// The fleet panel's endpoints (V2-35, docs/FLEET.md §4.1). Behind `CompanyGuard` like everything under `/fleet`: no session 401, not a
// corporate account of a company 403. Every call is for the company of the signed-in account and for no other; a record of another
// company is a 404. What changes is written to the audit log with the company on the line (AuditInterceptor). The id of the record is
// in the log; the person's name and e-mail address are not.
const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};
const numberParam = (request: Request): string | null => {
  const raw = request.params['number'];
  return typeof raw === 'string' ? raw.toUpperCase() : null;
};
const resultId = (_request: Request, result: unknown): string | null => (result as { id?: string } | null)?.id ?? null;

@ApiTags('fleet')
@Controller('fleet/reports')
export class FleetReportsController {
  constructor(private readonly reports: FleetReportsService) {}

  @Get()
  get(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Report> {
    return this.reports.get(companyId, query);
  }
}

@ApiTags('fleet')
@Controller('fleet/summary')
export class FleetSummaryController {
  constructor(private readonly summary: FleetSummaryService) {}

  @Get()
  get(@CurrentCompany() companyId: string): Promise<FleetSummary> {
    return this.summary.get(companyId);
  }
}

@ApiTags('fleet')
@Controller('fleet/vehicles')
export class FleetVehiclesController {
  constructor(private readonly vehicles: FleetVehiclesService) {}

  @Get()
  list(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Page<FleetVehicleView>> {
    return this.vehicles.list(companyId, query);
  }

  @Get(':plate')
  get(@CurrentCompany() companyId: string, @Param('plate') plate: string): Promise<FleetVehicleDetail> {
    return this.vehicles.get(companyId, plate);
  }
}

@ApiTags('fleet')
@Controller('fleet/contracts')
export class FleetContractsController {
  constructor(private readonly contracts: FleetContractsService) {}

  @Get()
  list(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Page<ContractView>> {
    return this.contracts.list(companyId, query);
  }

  @Get(':number')
  get(@CurrentCompany() companyId: string, @Param('number') number: string): Promise<ContractDetail> {
    return this.contracts.get(companyId, number);
  }

  // Asks the sales team to renew the contract (V2-38): a quote request, marked as a renewal. 201 with its reference number.
  @Post(':number/renewal-request')
  @Audited({ action: 'fleet-contract.renewal-request', entity: 'contract', entityId: numberParam })
  renew(@CurrentUser() user: UserRow, @CurrentCompany() companyId: string, @Param('number') number: string, @Body() body: unknown): Promise<QuoteReceived> {
    return this.contracts.requestRenewal(user, companyId, number, body);
  }
}

@ApiTags('fleet')
@Controller('fleet/employees')
export class FleetEmployeesController {
  constructor(private readonly employees: FleetEmployeesService) {}

  @Get()
  list(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Page<EmployeeView>> {
    return this.employees.list(companyId, query);
  }

  @Get(':id')
  get(@CurrentCompany() companyId: string, @Param('id') id: string): Promise<EmployeeView> {
    return this.employees.get(companyId, id);
  }

  @Post()
  @Audited({ action: 'fleet-employee.create', entity: 'employee', entityId: resultId })
  create(@CurrentCompany() companyId: string, @Body() body: unknown): Promise<EmployeeView> {
    return this.employees.create(companyId, body);
  }

  @Patch(':id')
  @Audited({ action: 'fleet-employee.update', entity: 'employee', entityId: idParam })
  update(@CurrentCompany() companyId: string, @Param('id') id: string, @Body() body: unknown): Promise<EmployeeView> {
    return this.employees.update(companyId, id, body);
  }
}

@ApiTags('fleet')
@Controller('fleet/invoices')
export class FleetInvoicesController {
  constructor(private readonly invoices: FleetInvoicesService) {}

  @Get()
  list(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Page<InvoiceView>> {
    return this.invoices.list(companyId, query);
  }

  @Get(':number')
  get(@CurrentCompany() companyId: string, @Param('number') number: string): Promise<InvoiceView> {
    return this.invoices.get(companyId, number);
  }
}

@ApiTags('fleet')
@Controller('fleet/assignments')
export class FleetAssignmentsController {
  constructor(private readonly assignments: FleetAssignmentsService) {}

  @Get()
  list(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Page<AssignmentView>> {
    return this.assignments.list(companyId, query);
  }

  @Post()
  @Audited({ action: 'fleet-assignment.create', entity: 'assignment', entityId: resultId })
  create(@CurrentCompany() companyId: string, @Body() body: unknown): Promise<AssignmentView> {
    return this.assignments.create(companyId, body);
  }

  @Post(':id/end')
  @HttpCode(200)
  @Audited({ action: 'fleet-assignment.end', entity: 'assignment', entityId: idParam })
  end(@CurrentCompany() companyId: string, @Param('id') id: string, @Body() body: unknown): Promise<AssignmentView> {
    return this.assignments.end(companyId, id, body);
  }
}

@ApiTags('fleet')
@Controller('fleet/expenses')
export class FleetExpensesController {
  constructor(private readonly expenses: FleetExpensesService) {}

  @Get()
  list(@CurrentCompany() companyId: string, @Query() query: unknown): Promise<Page<ExpenseView>> {
    return this.expenses.list(companyId, query);
  }

  // Many at once; declared before `:id` so `reflect` is never read as an id.
  @Post('reflect')
  @HttpCode(200)
  @Audited({ action: 'fleet-expense.reflect', entity: 'expense', entityId: () => null })
  reflect(@CurrentCompany() companyId: string, @Body() body: unknown): Promise<ReflectResult> {
    return this.expenses.reflect(companyId, body);
  }

  @Get(':id')
  get(@CurrentCompany() companyId: string, @Param('id') id: string): Promise<ExpenseView> {
    return this.expenses.get(companyId, id);
  }

  @Patch(':id')
  @Audited({ action: 'fleet-expense.update', entity: 'expense', entityId: idParam })
  update(@CurrentCompany() companyId: string, @Param('id') id: string, @Body() body: unknown): Promise<ExpenseView> {
    return this.expenses.setStatus(companyId, id, body);
  }
}
