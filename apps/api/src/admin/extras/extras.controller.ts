import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Audited } from '../audit.interceptor.js';
import { ExtrasService } from './extras.service.js';
import type { ExtraView } from './extras.view.js';

const slugParam = (request: Request): string | null => {
  const raw = request.params['slug'];
  return typeof raw === 'string' ? raw.toLowerCase() : null;
};

// Extra services (V2-30). Behind the administration guard like everything under `/admin`. Extras are not added or removed here.
@ApiTags('admin')
@Controller('admin/extras')
export class ExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  @Get()
  list(): Promise<ExtraView[]> {
    return this.extras.list();
  }

  @Get(':slug')
  get(@Param('slug') slug: string): Promise<ExtraView> {
    return this.extras.get(slug);
  }

  @Patch(':slug')
  @Audited({ action: 'extra.update', entity: 'extra', entityId: slugParam })
  update(@Param('slug') slug: string, @Body() body: unknown): Promise<ExtraView> {
    return this.extras.update(slug, body);
  }
}
