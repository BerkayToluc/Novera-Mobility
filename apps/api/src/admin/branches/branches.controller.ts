import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { BranchesService } from './branches.service.js';
import type { BranchUsage, BranchView } from './branches.view.js';

// Branches (V2-27). Behind the administration guard like everything under `/admin`: no session 401, not an administrator 403.
// The branch id is in the audit log as the entity; a branch is not personal data.
@ApiTags('admin')
@Controller('admin/branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<BranchView>> {
    return this.branches.list(query);
  }

  @Post()
  @Audited({ action: 'branch.create', entity: 'branch', entityId: (_request, result) => (result as BranchView).id })
  create(@Body() body: unknown): Promise<BranchView> {
    return this.branches.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<BranchView & { usage: BranchUsage }> {
    return this.branches.get(id);
  }

  @Patch(':id')
  @Audited({ action: 'branch.update', entity: 'branch' })
  update(@Param('id') id: string, @Body() body: unknown): Promise<BranchView> {
    return this.branches.update(id, body);
  }

  // These two take no body: closing and opening again are decisions, not edits, and the same call can be repeated.
  @Post(':id/close')
  @HttpCode(200)
  @Audited({ action: 'branch.close', entity: 'branch' })
  close(@Param('id') id: string): Promise<BranchView> {
    return this.branches.close(id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @Audited({ action: 'branch.reopen', entity: 'branch' })
  reopen(@Param('id') id: string): Promise<BranchView> {
    return this.branches.reopen(id);
  }
}
