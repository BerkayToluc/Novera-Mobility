import { CANDIDATE_CONFIRM_AFTER_MS, MAX_RATE_JUMP, judgeRate } from './rate-guard.js';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const DAY = 24 * 60 * 60 * 1000;

describe('judgeRate (QUALITY V-10)', () => {
  it('stores a small move, and the first rate there is', () => {
    expect(judgeRate(0.018, 0.0185, null, NOW)).toEqual({ action: 'store' });
    expect(judgeRate(null, 0.5, null, NOW)).toEqual({ action: 'store' });
  });

  it('holds a big move back and remembers it from now', () => {
    const verdict = judgeRate(0.018, 0.018 * (1 + MAX_RATE_JUMP + 0.1), null, NOW);
    expect(verdict).toMatchObject({ action: 'hold', candidate: { since: NOW } });
  });

  it('keeps the first day of a candidate while the feed repeats it', () => {
    const jumped = 0.018 * 2;
    const verdict = judgeRate(0.018, jumped * 1.02, { ratePerTry: jumped, since: NOW }, later(DAY));
    expect(verdict).toMatchObject({ action: 'hold', candidate: { since: NOW } });
  });

  it('believes it two days after it first came', () => {
    const jumped = 0.018 * 2;
    expect(judgeRate(0.018, jumped, { ratePerTry: jumped, since: NOW }, later(CANDIDATE_CONFIRM_AFTER_MS))).toEqual({
      action: 'store',
    });
  });

  it('starts a new candidate when the value is on the other side of the stored rate', () => {
    const up = 0.018 * 2;
    const down = 0.018 * 0.3;
    expect(judgeRate(0.018, down, { ratePerTry: up, since: NOW }, later(CANDIDATE_CONFIRM_AFTER_MS))).toMatchObject({
      action: 'hold',
      candidate: { since: later(CANDIDATE_CONFIRM_AFTER_MS) },
    });
  });

  it('starts a new candidate when the value is far from the earlier candidate', () => {
    const verdict = judgeRate(0.018, 0.018 * 5, { ratePerTry: 0.018 * 2, since: NOW }, later(2 * DAY));
    expect(verdict).toMatchObject({ action: 'hold', candidate: { since: later(2 * DAY) } });
  });
});
