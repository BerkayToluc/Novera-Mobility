import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { isProduction } from '../config/runtime.js';
import { asFormInput } from '../forms/form-input.js';
import { clientKeyOf } from '../forms/rate-limiter.js';
import { GoogleAuthService } from './google-auth.service.js';
import { AuthService, type SessionStart } from './auth.service.js';
import { SESSION_COOKIE, readCookie } from './session-token.js';
import { toUserResponse, type UserResponse } from './user-view.js';

// Read per call, not once at import: .env is loaded after this file, so a constant would miss NODE_ENV=development.
const cookieBase = () => ({
  httpOnly: true,
  // Only sent over HTTPS, except when the API is explicitly in development (plain http on localhost).
  secure: isProduction(),
  sameSite: 'lax' as const,
  path: '/',
});

export function setSessionCookie(response: Response, session: SessionStart): void {
  response.cookie(SESSION_COOKIE, session.token, { ...cookieBase(), expires: session.expiresAt });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, cookieBase());
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GoogleAuthService) private readonly googleAuth: GoogleAuthService,
  ) {}

  @Post('register')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName', 'consent'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8, maxLength: 128 },
        firstName: { type: 'string', maxLength: 80 },
        lastName: { type: 'string', maxLength: 80 },
        consent: { type: 'boolean' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Hesap oluşturuldu, oturum açıldı (çerez set edilir)' })
  async register(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const session = await this.authService.register(asFormInput(body), clientKeyOf(request), request.headers['user-agent']);
    setSessionCookie(response, session);
    return toUserResponse(session.user);
  }

  @Post('login')
  @HttpCode(200)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ description: 'Oturum açıldı (çerez set edilir)' })
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const session = await this.authService.login(asFormInput(body), clientKeyOf(request), request.headers['user-agent']);
    setSessionCookie(response, session);
    return toUserResponse(session.user);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(readCookie(request.headers.cookie, SESSION_COOKIE));
    clearSessionCookie(response);
  }

  // 200 for an existing account, 201 when this call opened a new one.
  @Post('google')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['credential'],
      properties: { credential: { type: 'string', maxLength: 4096 }, consent: { type: 'boolean' } },
    },
  })
  @ApiOkResponse({ description: 'Mevcut hesapla oturum açıldı (çerez set edilir)' })
  @ApiCreatedResponse({ description: 'Yeni hesap oluşturuldu, oturum açıldı (çerez set edilir)' })
  async google(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const { session, created } = await this.googleAuth.signIn(
      asFormInput(body),
      clientKeyOf(request),
      request.headers['user-agent'],
    );
    setSessionCookie(response, session);
    response.status(created ? 201 : 200);
    return toUserResponse(session.user);
  }
}
