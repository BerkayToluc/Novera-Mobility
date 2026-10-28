import { hashPassword, needsRehash, verifyPassword } from './password.js';
import { hashSessionToken, newSessionToken, readCookie } from './session-token.js';

describe('parola özeti', () => {
  it('doğru parolayı kabul eder, yanlışı reddeder', async () => {
    const stored = await hashPassword('doğru-parola-123');
    expect(await verifyPassword('doğru-parola-123', stored)).toBe(true);
    expect(await verifyPassword('yanlış-parola', stored)).toBe(false);
  });

  it('aynı parola her seferinde farklı özet üretir (tuz) ve parolayı içermez', async () => {
    const a = await hashPassword('aynı-parola-1');
    const b = await hashPassword('aynı-parola-1');
    expect(a).not.toBe(b);
    expect(a).not.toContain('aynı-parola-1');
    expect(a.startsWith('scrypt$')).toBe(true);
  });

  it('bozuk saklanmış değerde hata atmaz, false döner', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$a$b')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });
});

describe('oturum anahtarı', () => {
  it('rastgele ve uzun anahtar üretir, özeti anahtardan farklıdır', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(hashSessionToken(a)).not.toBe(a);
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
  });

  it('Cookie başlığından doğru çerezi okur', () => {
    expect(readCookie('a=1; novera_session=abc%2Fdef; b=2', 'novera_session')).toBe('abc/def');
    expect(readCookie('a=1', 'novera_session')).toBeNull();
    expect(readCookie(undefined, 'novera_session')).toBeNull();
    expect(readCookie('novera_session=', 'novera_session')).toBeNull();
    expect(readCookie('novera_session=%E0%A4%A', 'novera_session')).toBeNull();
  });
});

describe('parola özeti: maliyet ve yenileme (V2-10, QUALITY G-12)', () => {
  // The real cost is used here (about 128 MiB and a third of a second per hash); the other specs use the light one.
  beforeAll(() => {
    process.env.NOVERA_REAL_SCRYPT = '1';
  });
  afterAll(() => {
    delete process.env.NOVERA_REAL_SCRYPT;
  });

  it('a new hash has N = 2^17', async () => {
    const stored = await hashPassword('guclu-parola-1');
    expect(stored.split('$')[1]).toBe(String(2 ** 17));
    expect(await verifyPassword('guclu-parola-1', stored)).toBe(true);
    expect(await verifyPassword('guclu-parola-2', stored)).toBe(false);
    expect(needsRehash(stored)).toBe(false);
  });

  it('a hash made with the old cost still verifies and is marked for replacement', async () => {
    const old = await hashPassword('eski-parola-1', 16384);
    expect(old.split('$')[1]).toBe('16384');
    expect(await verifyPassword('eski-parola-1', old)).toBe(true);
    expect(needsRehash(old)).toBe(true);
  });

  it('a stored value that is not a hash is not marked', () => {
    expect(needsRehash('')).toBe(false);
    expect(needsRehash('bcrypt$1$2$3$4$5')).toBe(false);
  });

  it('several hashes at once wait in line and all finish (memory stays bounded)', async () => {
    const hashes = await Promise.all(Array.from({ length: 4 }, (_, i) => hashPassword(`parola-numara-${i}`)));
    expect(new Set(hashes).size).toBe(4);
  });
});
