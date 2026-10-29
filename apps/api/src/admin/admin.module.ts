import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminSummaryService } from './admin-summary.service.js';
import { BranchesController } from './branches/branches.controller.js';
import { BranchesService } from './branches/branches.service.js';
import { PromoCodesController } from './promo-codes.controller.js';
import { PromoCodesService } from './promo-codes.service.js';
import { AdminGuard } from './admin.guard.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditService } from './audit.service.js';

// The administration (ADR-24): the role guard and the audit log for everything under `/admin`. Imported after the
// rate limit module, so a request is counted before it is turned away.
@Module({
  imports: [AuthModule],
  controllers: [AdminController, PromoCodesController, BranchesController],
  providers: [
    AuditService,
    AdminSummaryService,
    PromoCodesService,
    BranchesService,
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AdminModule {}
