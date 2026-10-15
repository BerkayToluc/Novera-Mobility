import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { asFormInput } from '../forms/form-input.js';
import { clearSessionCookie } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, SessionGuard } from './session.guard.js';
import { toUserResponse, type UserResponse, type UserRow } from './user-view.js';

@ApiTags('me')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('me')
export class MeController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get()
  me(@CurrentUser() user: UserRow): UserResponse {
    return toUserResponse(user);
  }

  @Patch()
  async update(@CurrentUser() user: UserRow, @Body() body: unknown): Promise<UserResponse> {
    return toUserResponse(await this.authService.updateProfile(user.id, asFormInput(body)));
  }

  @Delete()
  @HttpCode(204)
  async remove(
    @CurrentUser() user: UserRow,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.deleteAccount(user.id);
    clearSessionCookie(response);
  }
}