import { DAY_MS } from '../common/time.js';

// A new rate that differs from the stored one by more than this share is not taken at once.
export const MAX_RATE_JUMP = 0.5;
// ...but when the feed says the same thing again on the third day (two days after it first said it), it is believed:
// a real, lasting move (a devaluation) must not leave the rates locked at the old value for ever (QUALITY V-10).
export const CANDIDATE_CONFIRM_AFTER_MS = 2 * DAY_MS;

export type RateCandidateState = { ratePerTry: number; since: Date } | null;

export type RateVerdict =
  | { action: 'store' }
  // The value stays out; `candidate` is what to remember until the feed confirms or contradicts it.
  | { action: 'hold'; candidate: { ratePerTry: number; since: Date }; reason: string };

const movedBy = (from: number, to: number): number => Math.abs(to - from) / from;

export function judgeRate(stored: number | null, fresh: number, candidate: RateCandidateState, now: Date): RateVerdict {
  if (stored === null || !(stored > 0) || movedBy(stored, fresh) <= MAX_RATE_JUMP) return { action: 'store' };

  // Far from the stored rate. If it also agrees with what the feed said before (same side, within the same margin of the
  // candidate), the clock of that candidate keeps running; otherwise this value starts a new one.
  const agrees = candidate !== null && Math.sign(candidate.ratePerTry - stored) === Math.sign(fresh - stored) && movedBy(candidate.ratePerTry, fresh) <= MAX_RATE_JUMP;
  const since = agrees ? candidate.since : now;
  if (agrees && now.getTime() - since.getTime() >= CANDIDATE_CONFIRM_AFTER_MS) return { action: 'store' };
  return {
    action: 'hold',
    candidate: { ratePerTry: fresh, since },
    reason: `moved from ${stored} to ${fresh}, held back since ${since.toISOString()}`,
  };
}
