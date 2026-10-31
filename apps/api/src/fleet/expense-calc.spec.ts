import { assigneeAt, canMoveExpense, type AssignmentSpan } from './expense-calc.js';

const at = (iso: string) => new Date(iso);
const span = (employeeId: string, startedAt: string, endedAt: string | null): AssignmentSpan => ({ employeeId, startedAt: at(startedAt), endedAt: endedAt ? at(endedAt) : null });

describe('who an expense belongs to (V2-38, FLEET.md §3.1)', () => {
  // Ayşe had the car until the 10th at noon; Burak has it from then on.
  const handover = '2026-10-10T12:00:00.000Z';
  const list = [span('ayse', '2026-09-01T08:00:00.000Z', handover), span('burak', handover, null)];

  it('an expense just before the handover is the first person’s, one just after is the second’s', () => {
    expect(assigneeAt(list, at('2026-10-10T11:59:59.999Z'))?.employeeId).toBe('ayse');
    expect(assigneeAt(list, at('2026-10-10T12:00:00.001Z'))?.employeeId).toBe('burak');
  });

  it('the moment of the handover belongs to the person who takes the car', () => {
    expect(assigneeAt(list, at(handover))?.employeeId).toBe('burak');
  });

  it('the answer does not depend on the order the assignments come in', () => {
    expect(assigneeAt([...list].reverse(), at('2026-10-10T11:00:00.000Z'))?.employeeId).toBe('ayse');
    expect(assigneeAt([...list].reverse(), at('2026-10-10T13:00:00.000Z'))?.employeeId).toBe('burak');
  });

  it('before the first assignment, and in a gap between two, nobody had the car', () => {
    expect(assigneeAt(list, at('2026-08-31T23:59:59.999Z'))).toBeNull();
    const gap = [span('ayse', '2026-09-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z'), span('burak', '2026-09-20T00:00:00.000Z', null)];
    expect(assigneeAt(gap, at('2026-09-15T00:00:00.000Z'))).toBeNull();
  });

  it('an open assignment has the car for as long as it is open, and the first moment of it counts', () => {
    expect(assigneeAt([span('burak', '2026-10-10T12:00:00.000Z', null)], at('2026-10-10T12:00:00.000Z'))?.employeeId).toBe('burak');
    expect(assigneeAt([span('burak', '2026-10-10T12:00:00.000Z', null)], at('2030-01-01T00:00:00.000Z'))?.employeeId).toBe('burak');
  });

  it('no assignments is nobody', () => {
    expect(assigneeAt([], at('2026-10-10T12:00:00.000Z'))).toBeNull();
  });

  it('when two overlap, the one that started last has it', () => {
    const overlap = [span('ayse', '2026-10-01T00:00:00.000Z', '2026-10-20T00:00:00.000Z'), span('burak', '2026-10-05T00:00:00.000Z', '2026-10-08T00:00:00.000Z')];
    expect(assigneeAt(overlap, at('2026-10-06T00:00:00.000Z'))?.employeeId).toBe('burak');
    expect(assigneeAt(overlap, at('2026-10-09T00:00:00.000Z'))?.employeeId).toBe('ayse');
  });
});

describe('what a customer may do to an expense (V2-38)', () => {
  it('open can be reflected or disputed, and a dispute can be taken back', () => {
    expect(canMoveExpense('OPEN', 'REFLECTED')).toBe(true);
    expect(canMoveExpense('OPEN', 'DISPUTED')).toBe(true);
    expect(canMoveExpense('DISPUTED', 'OPEN')).toBe(true);
  });

  it('a disputed expense is not reflected without being taken back first, and a reflected one is final', () => {
    expect(canMoveExpense('DISPUTED', 'REFLECTED')).toBe(false);
    expect(canMoveExpense('REFLECTED', 'OPEN')).toBe(false);
    expect(canMoveExpense('REFLECTED', 'DISPUTED')).toBe(false);
  });

  it('asking for the state it is in is allowed', () => {
    for (const state of ['OPEN', 'REFLECTED', 'DISPUTED'] as const) expect(canMoveExpense(state, state)).toBe(true);
  });
});
