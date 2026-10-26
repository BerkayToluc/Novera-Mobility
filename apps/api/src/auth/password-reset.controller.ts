import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../common/rate-limit.js';
import { LIMITS } from '../common/rate-limits.js';
import { PasswordResetService } from './password-reset.service.js';

@ApiTags('auth')
@Controller('auth')
export class PasswordResetController {
  constructor(@Inject(PasswordResetService) private readonly reset: PasswordResetService) {}

  @Post('forgot-password')
  @RateLimit(LIMITS.forgot, LIMITS.forgotEmail)
  @HttpCode(202)
  @ApiBody({
    schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
  })
  @ApiAcceptedResponse({ description: 'Request accepted, whether or not the e-mail has an account' })
  async forgot(@Body() body: unknown): Promise<void> {
    await this.reset.requestReset(body);
  }

  @Post('reset-password')
  @RateLimit(LIMITS.reset)
  @HttpCode(204)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password'],
      properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8, maxLength: 128 } },
    },
  })
  @ApiNoContentResponse({ description: 'Password changed; every session is closed' })
  async resetPassword(@Body() body: unknown): Promise<void> {
    await this.reset.resetPassword(body);
  }
}
