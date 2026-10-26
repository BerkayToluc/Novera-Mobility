import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { clientKeyOf } from '../forms/rate-limiter.js';
import { PasswordResetService } from './password-reset.service.js';

@ApiTags('auth')
@Controller('auth')
export class PasswordResetController {
  constructor(@Inject(PasswordResetService) private readonly reset: PasswordResetService) {}

  @Post('forgot-password')
  @HttpCode(202)
  @ApiBody({
    schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
  })
  @ApiAcceptedResponse({ description: 'Request accepted, whether or not the e-mail has an account' })
  async forgot(@Body() body: unknown, @Req() request: Request): Promise<void> {
    await this.reset.requestReset(body, clientKeyOf(request));
  }

  @Post('reset-password')
  @HttpCode(204)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password'],
      properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8, maxLength: 128 } },
    },
  })
  @ApiNoContentResponse({ description: 'Password changed; every session is closed' })
  async resetPassword(@Body() body: unknown, @Req() request: Request): Promise<void> {
    await this.reset.resetPassword(body, clientKeyOf(request));
  }
}
