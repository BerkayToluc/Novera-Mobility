import { Inject, Injectable } from '@nestjs/common';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { rateLimited } from '../forms/form-input.js';
import { RateLimiter } from '../forms/rate-limiter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { emailTaken, googleNotAllowed, googleTokenInvalid, googleUnavailable } from './auth.errors.js';
import { googleSchema } from './auth.schemas.js';
import type { SessionStart } from './auth.service.js';
import { cleanUserAgent } from './device.js';
import { GoogleTokenError, GoogleTokenVerifier, type GoogleProfile } from './google-verifier.js';
import { SESSION_DAYS, hashSessionToken, newSessionToken } from './session-token.js';

// POST /auth/google: sign in or sign up with a Google ID token (individual accounts only).
export const GOOGLE_LIMIT_PER_15_MIN = 10;
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_MAX = 80;

export interface GoogleSignInResult {
  session: SessionStart;
  // True when this call opened a new account (HTTP 201), false for an existing one (HTTP 200).
  created: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

// Google gives given/family names; when it does not, split the display name, then fall back to the
// part of the e-mail before the @, so the required name fields are never empty.
export function namesFrom(profile: GoogleProfile): { firstName: string; lastName: string } {
  const parts = (profile.name ?? '').split(/\s+/).filter(Boolean);
  const first = profile.givenName ?? parts[0] ?? profile.email.split('@')[0] ?? 'Novera';
  const last = profile.familyName ?? (parts.length > 1 ? parts.slice(1).join(' ') : null) ?? '-';
  return { firstName: first.slice(0, NAME_MAX), lastName: last.slice(0, NAME_MAX) };
}

@Injectable()
export class GoogleAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(GoogleTokenVerifier) private readonly verifier: GoogleTokenVerifier,
  ) {}

  async signIn(input: unknown, clientKey: string, userAgent: unknown = null): Promise<GoogleSignInResult> {
    if (!this.verifier.isConfigured()) throw googleUnavailable();
    if (!this.limiter.allow(`google:${clientKey}`, GOOGLE_LIMIT_PER_15_MIN, QUARTER_HOUR_MS)) {
      throw rateLimited();
    }

    const { credential, consent } = parseInput(googleSchema, input, 'Google sign-in data is invalid');

    let profile: GoogleProfile;
    try {
      profile = await this.verifier.verify(credential);
    } catch (error) {
      if (error instanceof GoogleTokenError) throw googleTokenInvalid();
      throw error;
    }

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    const newSession = () => ({
      tokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: cleanUserAgent(userAgent),
    });

    const bySub = await this.prisma.user.findUnique({ where: { googleSub: profile.sub } });
    if (bySub) {
      if (bySub.accountType !== 'INDIVIDUAL') throw googleNotAllowed();
      await this.prisma.$transaction([
        this.prisma.session.deleteMany({ where: { userId: bySub.id, expiresAt: { lt: new Date() } } }),
        this.prisma.session.create({ data: { ...newSession(), userId: bySub.id } }),
      ]);
      return { session: { user: bySub, token, expiresAt }, created: false };
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      // Same verified e-mail, but another Google account is already linked, or a corporate account.
      if (byEmail.accountType !== 'INDIVIDUAL' || byEmail.googleSub !== null) throw googleNotAllowed();
      // Linking. Sign-up with a password never proved the e-mail belongs to the person, so whoever
      // registered it first could still hold the password or a session. Both go: the owner proved the
      // e-mail with Google now and can use Google or "forgot password" from here on.
      const [user] = await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: profile.sub, passwordHash: null } }),
        this.prisma.session.deleteMany({ where: { userId: byEmail.id } }),
        this.prisma.passwordResetToken.deleteMany({ where: { userId: byEmail.id } }),
        this.prisma.session.create({ data: { ...newSession(), userId: byEmail.id } }),
      ]);
      return { session: { user, token, expiresAt }, created: false };
    }

    // A new account needs the KVKK consent, like the password sign-up. The web shows the checkbox
    // and sends the same credential again with consent: true.
    if (consent !== true) {
      throw validationFailed({ consent: 'CONSENT_REQUIRED' }, 'Consent is required to create an account');
    }
    const { firstName, lastName } = namesFrom(profile);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: profile.email,
          googleSub: profile.sub,
          passwordHash: null,
          firstName,
          lastName,
          sessions: { create: newSession() },
        },
      });
      return { session: { user, token, expiresAt }, created: true };
    } catch (error) {
      // Two simultaneous first sign-ins: the second one is refused by the database.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }
}
