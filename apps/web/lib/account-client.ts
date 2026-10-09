import { AuthUnavailableError } from "./auth-client";
import type { ProfileInput } from "./profile-schemas";
import type { Reservation } from "./reservation";

// Same stance as auth-client.ts: the API does not exist yet (BACKLOG #22, #28), so each
// call says so instead of pretending to work. Only this file changes when it does.
export async function updateProfile(input: ProfileInput): Promise<void> {
  void input;
  throw new AuthUnavailableError();
}

export async function deleteAccount(): Promise<void> {
  throw new AuthUnavailableError();
}

export async function getMyReservations(): Promise<Reservation[]> {
  throw new AuthUnavailableError();
}
