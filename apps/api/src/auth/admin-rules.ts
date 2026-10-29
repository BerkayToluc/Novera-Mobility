// What is stricter for an administrator (V2-23, ADR-24, docs/ADMIN.md §2). Shared by the sign-in, the password
// rules and `pnpm admin:create`, so the numbers live in one place.
export const ADMIN_PASSWORD_MIN = 12;
// A session ends 12 hours after sign-in whatever happens, and after an hour without being used. A customer's is 30 days
// and 7 days (session-token.ts). The rule follows the account's role at every request, not the session's own
// `expiresAt`: an account given the role later is held to it at once, with the sessions it already had.
export const ADMIN_SESSION_HOURS = 12;
export const ADMIN_IDLE_MINUTES = 60;

export type RoleName = 'CUSTOMER' | 'ADMIN';
export const isAdmin = (user: { role: RoleName }): boolean => user.role === 'ADMIN';
