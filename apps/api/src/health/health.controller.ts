import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { NoRateLimit } from '../common/rate-limit.js';

@ApiTags('health')
// The host's health check asks often and must always be answered.
@NoRateLimit()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API çalışıyor' })
  check() {
    return { status: 'ok' };
  }
}