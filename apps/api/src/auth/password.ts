import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Parola özeti (hash). Ek paket gerekmez: Node'un kendi `scrypt`'i kullanılır.
// Saklanan metin: scrypt$N$r$p$tuz$özet (tuz ve özet base64). Parametreler metnin içinde
// durur, böylece ileride güçlendirilse bile eski parolalar doğrulanmaya devam eder.
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// N = 2^17, the current OWASP recommendation for scrypt with r = 8 and p = 1 (QUALITY G-12). One hash needs about
// 128 MiB, so `maxmem` is set above that and only HASH_CONCURRENCY hashes run at a time: on a small instance a
// burst of sign-ins waits in line instead of running the memory out.
const COST = 2 ** 17; // N
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p
const MAX_MEMORY = 256 * 1024 * 1024;
const HASH_CONCURRENCY = 1;

// The cost a new hash gets. Tests lower it (a few thousand hashes at the real cost would take minutes) unless
// NOVERA_REAL_SCRYPT=1 asks for the real one; NODE_ENV=test is already the "not production" setting (isProduction).
export function currentCost(): number {
  return process.env.NODE_ENV === 'test' &&
    process.env.NOVERA_REAL_SCRYPT !== '1'
    ? 2 ** 10
    : COST;
}

let running = 0;
const waiting: Array<() => void> = [];
async function turn<T>(work: () => Promise<T>): Promise<T> {
  if (running >= HASH_CONCURRENCY)
    await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await work();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
  keyLength: number,
): Promise<Buffer> {
  return turn(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password,
          salt,
          keyLength,
          { N: cost, r: blockSize, p: parallelism, maxmem: MAX_MEMORY },
          (error, key) => (error ? reject(error) : resolve(key)),
        );
      }),
  );
}

export async function hashPassword(
  password: string,
  cost: number = currentCost(),
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(
    password,
    salt,
    cost,
    BLOCK_SIZE,
    PARALLELISM,
    KEY_LENGTH,
  );
  return [
    'scrypt',
    cost,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelism = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expected = Buffer.from(parts[5] ?? '', 'base64');
  if (
    !cost ||
    !blockSize ||
    !parallelism ||
    salt.length === 0 ||
    expected.length === 0
  ) {
    return false;
  }
  const actual = await derive(
    password,
    salt,
    cost,
    blockSize,
    parallelism,
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// True when a stored hash was made with a lower cost than today's: it is replaced with a new one after a
// successful sign-in, the only moment the password is known (QUALITY G-12).
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  return Number.isFinite(cost) && cost < currentCost();
}

// Olmayan bir e-postayla giriş denenince de aynı süre harcansın diye sahte bir özetle
// doğrulama yapılır; böylece yanıt süresinden hesabın var olup olmadığı anlaşılmaz.
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('novera-dummy-password');
  await verifyPassword(password, await dummyHash);
}
