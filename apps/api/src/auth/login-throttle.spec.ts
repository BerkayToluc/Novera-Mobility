import { failureWait, FREE_FAILED_ATTEMPTS } from './login-throttle.js';

describe('the wait after failed sign-ins (V2-10, QUALITY G-15)', () => {
  const minutes = (failures: number) => failureWait(failures) / 60_000;

  it('doubles from one minute and stops at fifteen', () => {
    const first = FREE_FAILED_ATTEMPTS + 1;
    expect([0, 1, 2, 3, 4, 5, 6].map((step) => minutes(first + step))).toEqual([1, 2, 4, 8, 15, 15, 15]);
  });

  it('there are free attempts before the first wait', () => {
    expect(FREE_FAILED_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });
});
