// The wait after failed sign-ins for one e-mail address (V2-10, QUALITY G-15). It replaces the old limit that locked
// the account for 15 minutes after ten wrong tries by anyone, which let a stranger keep the owner out.
//
// The first FREE_FAILED_ATTEMPTS failures cost nothing. The next ones make the address wait 1, 2, 4, 8 minutes and then
// 15, the most. A failure that comes more than THROTTLE_MEMORY_MS after the last one starts the count again.
export const FREE_FAILED_ATTEMPTS = 5;
export const THROTTLE_MEMORY_MS = 60 * 60 * 1000;
const MAX_WAIT_MS = 15 * 60 * 1000;

// Milliseconds to wait after the given number of failures in a row (more than FREE_FAILED_ATTEMPTS).
export function failureWait(failures: number): number {
  const steps = failures - FREE_FAILED_ATTEMPTS - 1;
  return Math.min(MAX_WAIT_MS, 2 ** Math.max(0, steps) * 60_000);
}
