import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminSummaryService } from './admin-summary.service.js';
import { BranchesController } from './branches/branches.controller.js';
import { BranchesService } from './branches/branches.service.js';
import { VehicleClassesController, VehicleModelsController } from './vehicle-models/vehicle-models.controller.js';
import { VehicleModelsService } from './vehicle-models/vehicle-models.service.js';
import { AuditLogController } from './audit-log/audit-log.controller.js';
import { AuditLogService } from './audit-log/audit-log.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';
import { InvoicesController } from './invoices/invoices.controller.js';
import { InvoicesService } from './invoices/invoices.service.js';
import { AdminFleetExpensesController } from './fleet-expenses/fleet-expenses.controller.js';
import { AdminFleetExpensesService } from './fleet-expenses/fleet-expenses.service.js';
import { AdminRequestsController } from './requests/requests.controller.js';
import { AdminRequestsService } from './requests/requests.service.js';
import { AdminContractsController } from './contracts/contracts.controller.js';
import { AdminContractsService } from './contracts/contracts.service.js';
import { CompaniesController } from './companies/companies.controller.js';
import { CompaniesService } from './companies/companies.service.js';
import { AdminMessagesController } from './messages/messages.controller.js';
import { AdminMessagesService } from './messages/messages.service.js';
import { AdminQuotesController } from './quotes/quotes.controller.js';
import { AdminQuotesService } from './quotes/quotes.service.js';
import { AdminReservationsController } from './reservations/reservations.controller.js';
import { AdminReservationsService } from './reservations/reservations.service.js';
import { ExtrasController } from './extras/extras.controller.js';
import { ExtrasService } from './extras/extras.service.js';
import { VehiclesController } from './vehicles/vehicles.controller.js';
import { VehiclesService } from './vehicles/vehicles.service.js';
import { PromoCodesController } from './promo-codes.controller.js';
import { PromoCodesService } from './promo-codes.service.js';
import { AdminGuard } from './admin.guard.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditService } from './audit.service.js';

// The administration (ADR-24): the role guard and the audit log for everything under `/admin`. Imported after the
// rate limit module, so a request is counted before it is turned away.
@Module({
  imports: [AuthModule],
  controllers: [AdminController, PromoCodesController, BranchesController, VehicleModelsController, VehicleClassesController, VehiclesController, ExtrasController, AdminReservationsController, AdminQuotesController, AdminMessagesController, CompaniesController, UsersController, AuditLogController, AdminContractsController, InvoicesController, AdminFleetExpensesController, AdminRequestsController],
  providers: [
    AuditService,
    AdminSummaryService,
    PromoCodesService,
    BranchesService,
    VehicleModelsService,
    VehiclesService,
    ExtrasService,
    AdminReservationsService,
    AdminQuotesService,
    AdminMessagesService,
    CompaniesService,
    UsersService,
    AdminContractsService,
    InvoicesService,
    AdminFleetExpensesService,
    AdminRequestsService,
    AuditLogService,
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AdminModule {}
