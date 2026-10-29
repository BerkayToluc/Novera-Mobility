import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Page } from '../admin-list.js';
import { Audited } from '../audit.interceptor.js';
import { VehicleModelsService } from './vehicle-models.service.js';
import type { ModelUsage, ModelView } from './vehicle-models.view.js';

// The address of the model an audit row names: the slug from the path, written the way it is stored.
const slugParam = (request: Request): string | null => {
  const raw = request.params['slug'];
  return typeof raw === 'string' ? raw.toLowerCase() : null;
};

// Vehicle models (V2-29). Behind the administration guard like everything under `/admin`: no session 401, not an administrator
// 403. A model is not personal data, so its address is fine in the audit log.
@ApiTags('admin')
@Controller('admin/vehicle-models')
export class VehicleModelsController {
  constructor(private readonly models: VehicleModelsService) {}

  @Get()
  list(@Query() query: unknown): Promise<Page<ModelView>> {
    return this.models.list(query);
  }

  @Post()
  @Audited({ action: 'vehicle-model.create', entity: 'vehicle-model', entityId: (_request, result) => (result as ModelView).slug })
  create(@Body() body: unknown): Promise<ModelView> {
    return this.models.create(body);
  }

  @Get(':slug')
  get(@Param('slug') slug: string): Promise<ModelView & { usage: ModelUsage }> {
    return this.models.get(slug);
  }

  @Patch(':slug')
  @Audited({ action: 'vehicle-model.update', entity: 'vehicle-model', entityId: slugParam })
  update(@Param('slug') slug: string, @Body() body: unknown): Promise<ModelView> {
    return this.models.update(slug, body);
  }

  // These two take no body: retiring and putting back are decisions, not edits, and the same call can be repeated.
  @Post(':slug/retire')
  @HttpCode(200)
  @Audited({ action: 'vehicle-model.retire', entity: 'vehicle-model', entityId: slugParam })
  retire(@Param('slug') slug: string): Promise<ModelView> {
    return this.models.retire(slug);
  }

  @Post(':slug/restore')
  @HttpCode(200)
  @Audited({ action: 'vehicle-model.restore', entity: 'vehicle-model', entityId: slugParam })
  restore(@Param('slug') slug: string): Promise<ModelView> {
    return this.models.restore(slug);
  }
}

// The classes a model can be put in (the form's choice). They are fixed: none is added or changed here.
@ApiTags('admin')
@Controller('admin/vehicle-classes')
export class VehicleClassesController {
  constructor(private readonly models: VehicleModelsService) {}

  @Get()
  list(): Promise<Array<{ slug: string; name: { tr: string; en: string } }>> {
    return this.models.classes();
  }
}
