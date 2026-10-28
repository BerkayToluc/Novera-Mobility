import { isCommonPassword } from './common-passwords.js';
import { parseInput } from './zod-validation.js';
import { z } from 'zod';
import { password } from './zod-fields.js';

describe('common passwords (V2-10, QUALITY G-12)', () => {
  it.each(['password', 'Password', 'PASSWORD', 'qwertyuiop', 'password123', 'Password123', 'password1!', 'dragon2024', 'iloveyou99'])(
    '%s is refused',
    (value) => {
      expect(isCommonPassword(value)).toBe(true);
    },
  );

  it.each(['kirmizi-balon-yagmur', 'Zx9!mQp4#tLw', 'bir iki ucc dortt', 'ankara-1923-ataturk', 'xK7hnu3v'])('%s is not refused', (value) => {
    expect(isCommonPassword(value)).toBe(false);
  });

  it('a short base word with digits is not enough to count (so "dog90871" is not caught by accident)', () => {
    expect(isCommonPassword('dog90871')).toBe(false);
  });

  it('the new-password rule refuses it with PASSWORD_TOO_COMMON, and the sign-in rule does not look at the list', () => {
    const change = z.object({ next: password('new'), current: password('presented') });
    expect(() => parseInput(change, { next: 'password123', current: 'password123' }, 'x')).toThrow();
    try {
      parseInput(change, { next: 'password123', current: 'password123' }, 'x');
    } catch (error) {
      expect((error as { getResponse: () => { fieldErrors: unknown } }).getResponse().fieldErrors).toEqual({ next: 'PASSWORD_TOO_COMMON' });
    }
  });
});
