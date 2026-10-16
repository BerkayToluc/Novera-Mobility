import { AuthUnavailableError } from "./auth-client";
import type { ProfileInput } from "./profile-schemas";

// `PATCH /me` and `DELETE /me` are not connected yet (they need the signed-in session, BACKLOG #25),
// so each call says so instead of pretending to work. The account's bookings, points and quote
// requests are read in lib/account-server.ts: this file is imported by client components, and those
// reads need the request's cookies.
export async function updateProfile(input: ProfileInput): Promise<void> {
  void input;
  throw new AuthUnavailableError();
}

export async function deleteAccount(): Promise<void> {
  throw new AuthUnavailableError();
}
