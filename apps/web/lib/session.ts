import { cache } from "react";

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type Session = { user: SessionUser };

// There is no auth API yet (BACKLOG #25), so nobody is ever signed in and every profile
// page shows its "sign in first" state. When the API lands this reads the httpOnly
// session cookie (ARCHITECTURE ADR-08); the pages already handle both outcomes.
// `cache` makes the layout and the page share one lookup per request.
export const getSession = cache(async (): Promise<Session | null> => null);
