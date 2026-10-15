import { hashPassword, verifyPassword } from './password.js';
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
