import { AuthUnavailableError } from "./auth-client";
import type { ProfileInput } from "./profile-schemas";
import type { PointsAccount } from "./points";
import type { QuoteRequest } from "./quote-request";
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

// With USE_MOCKS=1 the corporate sample account has requests; otherwise the call says so, as above.
export async function getMyQuoteRequests(): Promise<QuoteRequest[]> {
  if (process.env.USE_MOCKS === "1") return (await import("@/mocks/quotes")).MOCK_QUOTE_REQUESTS;
  throw new AuthUnavailableError();
}

// Same stance for the points: sample data with USE_MOCKS=1, otherwise the service is unavailable.
export async function getMyPoints(): Promise<PointsAccount> {
  if (process.env.USE_MOCKS === "1") return (await import("@/mocks/reservations")).mockPoints(new Date());
  throw new AuthUnavailableError();
}
