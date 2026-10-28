import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimit } from '../common/rate-limit.js';
import { LIMITS } from '../common/rate-limits.js';
import { AccountSecurityService, type SessionView } from './account-security.service.js';
import { clearSessionCookie } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, SessionGuard } from './session.guard.js';
import { SESSION_COOKIE, hashSessionToken, readCookie } from './session-token.js';
import { toUserResponse, type UserResponse, type UserRow } from './user-view.js';

@ApiTags('me')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('me')
export class MeController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AccountSecurityService) private readonly security: AccountSecurityService,
  ) {}

  // The session asking, as the hash stored in the database (the cookie itself is never stored).
  private currentTokenHash(request: Request): string | null {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    return token ? hashSessionToken(token) : null;
  }

  @Get()
  me(@CurrentUser() user: UserRow): UserResponse {
    return toUserResponse(user);
  }

  @Patch()
  @RateLimit(LIMITS.accountWrite)
  async update(@CurrentUser() user: UserRow, @Body() body: unknown): Promise<UserResponse> {
    return toUserResponse(await this.authService.updateProfile(user.id, body));
  }

  @Post('password')
  @RateLimit(LIMITS.changePassword)
  @HttpCode(204)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: { type: 'string' },
        newPassword: { type: 'string', minLength: 8, maxLength: 128 },
      },
    },
  })
  async changePassword(@CurrentUser() user: UserRow, @Req() request: Request, @Body() body: unknown): Promise<void> {
    await this.security.changePassword(user, this.currentTokenHash(request), body);
  }

  @Get('sessions')
  @ApiOkResponse({ description: 'Hesabın açık oturumları, yeniden eskiye' })
  sessions(@CurrentUser() user: UserRow, @Req() request: Request): Promise<SessionView[]> {
    return this.security.listSessions(user.id, this.currentTokenHash(request));
  }

  @Delete('sessions')
  @RateLimit(LIMITS.accountWrite)
  @HttpCode(204)
  async revokeOthers(@CurrentUser() user: UserRow, @Req() request: Request): Promise<void> {
    await this.security.revokeOthers(user.id, this.currentTokenHash(request));
  }

  @Delete('sessions/:id')
  @RateLimit(LIMITS.accountWrite)
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const wasCurrent = await this.security.revokeSession(user.id, id, this.currentTokenHash(request));
    if (wasCurrent) clearSessionCookie(response);
  }

  // Asks for the password (or, for an account with none, the e-mail address). It checks a password, so it is limited like
  // the password change.
  @Delete()
  @RateLimit(LIMITS.changePassword)
  @HttpCode(204)
  async remove(
    @CurrentUser() user: UserRow,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.security.confirmDeletion(user, body);
    await this.authService.deleteAccount(user.id);
    clearSessionCookie(response);
  }
}
