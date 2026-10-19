import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { GoogleTokenError, JoseGoogleTokenVerifier } from './google-verifier.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

describe('JoseGoogleTokenVerifier', () => {
  let privateKey: CryptoKey;
  let other: CryptoKey;
  let verifier: JoseGoogleTokenVerifier;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    other = (await generateKeyPair('RS256')).privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), alg: 'RS256', use: 'sig', kid: 'k1' };
    verifier = new JoseGoogleTokenVerifier(CLIENT_ID, createLocalJWKSet({ keys: [jwk] }));
  });

  const sign = (claims: Record<string, unknown> = {}, opts: { iss?: string; aud?: string; exp?: string | number; key?: CryptoKey } = {}) =>
    new SignJWT({ email: 'Ayse@Example.com', email_verified: true, given_name: 'Ayşe', family_name: 'Yılmaz', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('sub-1')
      .setIssuer(opts.iss ?? 'https://accounts.google.com')
      .setAudience(opts.aud ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '10m')
      .sign(opts.key ?? privateKey);

  it('geçerli token profili döndürür (e-posta küçük harf)', async () => {
    await expect(verifier.verify(await sign())).resolves.toEqual({
      sub: 'sub-1',
      email: 'ayse@example.com',
      givenName: 'Ayşe',
      familyName: 'Yılmaz',
      name: null,
    });
  });

  it('"accounts.google.com" yayıncısını da kabul eder', async () => {
    await expect(verifier.verify(await sign({}, { iss: 'accounts.google.com' }))).resolves.toMatchObject({ sub: 'sub-1' });
  });

  it.each([
    ['yanlış hedef kitle', () => sign({}, { aud: 'baska-client' })],
    ['yanlış yayıncı', () => sign({}, { iss: 'https://evil.example' })],
    ['süresi dolmuş', () => sign({}, { exp: Math.floor(Date.now() / 1000) - 3600 })],
    ['başka anahtarla imzalı', () => sign({}, { key: other })],
    ['e-posta doğrulanmamış', () => sign({ email_verified: false })],
    ['e-posta yok', () => sign({ email: undefined })],
  ])('%s token reddedilir', async (_name, make) => {
    await expect(verifier.verify(await make())).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('bozuk metin reddedilir', async () => {
    await expect(verifier.verify('not-a-jwt')).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('Client ID yoksa ayarlı değildir ve doğrulama reddedilir', async () => {
    const unset = new JoseGoogleTokenVerifier(undefined, createLocalJWKSet({ keys: [] }));
    expect(unset.isConfigured()).toBe(false);
    await expect(unset.verify(await sign())).rejects.toBeInstanceOf(GoogleTokenError);
  });
});
