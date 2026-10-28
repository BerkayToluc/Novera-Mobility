import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { googleClientId } from '../config/env.js';

// Google ile giriş: web'deki Google düğmesinin verdiği ID token burada doğrulanır.
// İstemci sırrı gerekmez; imza Google'ın herkese açık anahtarlarıyla, hedef kitle (aud) bizim
// Client ID'miz ile denetlenir. Anahtarlar jose tarafından önbelleğe alınır.
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleProfile {
  sub: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
}

// Token geçersizse (imza, süre, hedef, yayıncı, doğrulanmamış e-posta) bu hata fırlatılır.
export class GoogleTokenError extends Error {}

export abstract class GoogleTokenVerifier {
  // Ayarlı mı (GOOGLE_CLIENT_ID dolu mu)?
  abstract isConfigured(): boolean;
  abstract verify(credential: string): Promise<GoogleProfile>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// Built by a factory in AuthModule (its constructor takes plain values, not injectable classes).
export class JoseGoogleTokenVerifier extends GoogleTokenVerifier {
  constructor(
    private readonly clientId: string | undefined = googleClientId(),
    private readonly keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)),
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  async verify(credential: string): Promise<GoogleProfile> {
    if (!this.clientId) throw new GoogleTokenError('GOOGLE_CLIENT_ID is not set');
    let payload;
    try {
      ({ payload } = await jwtVerify(credential, this.keys, {
        issuer: GOOGLE_ISSUERS,
        audience: this.clientId,
        algorithms: ['RS256'],
      }));
    } catch {
      throw new GoogleTokenError('The Google token is invalid or expired');
    }
    const sub = text(payload.sub);
    const email = text(payload.email)?.toLowerCase();
    if (!sub || !email) throw new GoogleTokenError('The Google token has no account id or e-mail');
    if (payload.email_verified !== true) throw new GoogleTokenError('The Google e-mail is not verified');
    return {
      sub,
      email,
      givenName: text(payload.given_name),
      familyName: text(payload.family_name),
      name: text(payload.name),
    };
  }
}
