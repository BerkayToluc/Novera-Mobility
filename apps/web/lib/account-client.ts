import { deleteMyAccount, updateProfile as updateProfileAction } from "./account-actions";
import { AuthUnavailableError } from "./auth-client";
import type { ProfileInput } from "./profile-schemas";

// What the profile forms call (client components import this file): the work is done by the server
// actions in account-actions.ts, and a failure becomes an error the forms can show. The account's
// bookings, points and quote requests are read in lib/account-server.ts, which needs the request's cookies.
export async function updateProfile(input: ProfileInput): Promise<void> {
  const result = await updateProfileAction(input);
  if (!result.ok) throw new AuthUnavailableError();
}

export async function deleteAccount(): Promise<void> {
  const result = await deleteMyAccount();
  if (!result.ok) throw new AuthUnavailableError();
}
