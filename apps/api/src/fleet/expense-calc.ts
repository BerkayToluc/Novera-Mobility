// Who an expense belongs to (V2-38, docs/FLEET.md §3.1, ADR-25). The person is never stored: it is whoever had the car at the moment of the
// expense, worked out whenever the expense is read. Pure functions, so the rule is tested without a database and the seed uses the same one.

export const EXPENSE_TYPES = ['HGS', 'PENALTY', 'MAINTENANCE', 'OTHER'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_STATUSES = ['OPEN', 'REFLECTED', 'DISPUTED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

// The largest amount one expense can have: 10 million TRY, in kuruş. A typo of a zero too many is caught here, not by the customer.
export const MAX_EXPENSE_AMOUNT = 1_000_000_000;

export type AssignmentSpan = { employeeId: string; startedAt: Date; endedAt: Date | null };

// The assignment that had the car at `at`: it started at or before that moment and had not ended by then. An assignment ends the instant
// the next one starts, and the moment they share belongs to the one that starts: `[startedAt, endedAt)`. An expense before the first
// assignment, or in a gap between two, has nobody. Should assignments ever overlap (the database allows one open assignment per car, but
// the closed ones are not checked against each other), the one that started last wins, so the answer never depends on the order given.
export function assigneeAt<T extends AssignmentSpan>(assignments: readonly T[], at: Date): T | null {
  let found: T | null = null;
  for (const span of assignments) {
    if (span.startedAt.getTime() > at.getTime()) continue;
    if (span.endedAt !== null && span.endedAt.getTime() <= at.getTime()) continue;
    if (found === null || span.startedAt.getTime() > found.startedAt.getTime()) found = span;
  }
  return found;
}

// What a customer may do to an expense. Open can be reflected to the person or disputed; a dispute can be taken back; a reflected expense is
// final. Asking for the state it is in already is allowed and changes nothing.
export function canMoveExpense(from: ExpenseStatus, to: ExpenseStatus): boolean {
  if (from === to) return true;
  if (from === 'OPEN') return to === 'REFLECTED' || to === 'DISPUTED';
  if (from === 'DISPUTED') return to === 'OPEN';
  return false;
}
