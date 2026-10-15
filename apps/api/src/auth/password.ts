import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Parola özeti (hash). Ek paket gerekmez: Node'un kendi `scrypt`'i kullanılır.
// Saklanan metin: scrypt$N$r$p$tuz$özet (tuz ve özet base64). Parametreler metnin içinde
// durur, böylece ileride güçlendirilse bile eski parolalar doğrulanmaya devam eder.
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 16384; // N
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelism, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM, KEY_LENGTH);
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelism = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expected = Buffer.from(parts[5] ?? '', 'base64');
  if (!cost || !blockSize || !parallelism || salt.length === 0 || expected.length === 0) {
    return false;
  }
  const actual = await derive(password, salt, cost, blockSize, parallelism, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Olmayan bir e-postayla giriş denenince de aynı süre harcansın diye sahte bir özetle
// doğrulama yapılır; böylece yanıt süresinden hesabın var olup olmadığı anlaşılmaz.
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('novera-dummy-password');
  await verifyPassword(password, await dummyHash);
}
