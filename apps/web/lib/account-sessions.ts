// A place the account is signed in (`GET /me/sessions`). `device` is the short name the API worked out
// from the browser at sign-in ("Chrome · Windows"), or null when it could not.
export type AccountSession = { id: string; current: boolean; device: string | null; createdAt: string; expiresAt: string };
