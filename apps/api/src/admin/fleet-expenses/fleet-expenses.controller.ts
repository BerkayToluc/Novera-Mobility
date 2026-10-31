import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { ExpenseView } from '../../fleet/expense.view.js';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { AdminFleetExpensesService } from './fleet-expenses.service.js';

// What the audit rows name: the id of the expense, and the company it is for. Neither is personal data.
const idParam = (request: Request): string | null => {
  const raw = request.params['id'];
  return typeof raw === 'string' ? raw : null;
};
const resultId = (_request: Request, result: unknown): string | null => (result as { id?: string } | null)?.id ?? null;
const resultCompany = (_request: Request, result: unknown): string | null => (result as { company?: { id?: string } } | null)?.company?.id ?? null;

// The expenses of the fleets (V2-38). Behind the administration guard like everything under `/admin`: no session 401, not an
// administrator 403.
@ApiTags('admin')
@Controller('admin/fleet-expenses')
export class AdminFleetExpensesController {
  constructor(private readonly expenses: AdminFleetExpensesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<ExpenseView>> {
    return this.expenses.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ExpenseView> {
    return this.expenses.get(id);
  }

  @Post()
  @Audited({ action: 'fleet-expense.create', entity: 'fleet-expense', entityId: resultId, companyId: resultCompany })
  create(@Body() body: unknown): Promise<ExpenseView> {
    return this.expenses.create(body);
  }

  @Patch(':id')
  @Audited({ action: 'fleet-expense.update', entity: 'fleet-expense', entityId: idParam, companyId: resultCompany })
  update(@Param('id') id: string, @Body() body: unknown): Promise<ExpenseView> {
    return this.expenses.update(id, body);
  }
}
