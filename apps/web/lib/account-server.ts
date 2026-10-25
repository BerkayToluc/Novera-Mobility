import "server-only";
import { cookies } from "next/headers";
import type { AccountSession } from "./account-sessions";
import { fetchMyPoints, fetchMyQuoteRequests, fetchMyReservations, fetchMySessions } from "./api-account";
import { SESSIONS_REVOKED_COOKIE } from "./notifications";
import type { PointsAccount } from "./points";
import type { QuoteRequest } from "./quote-request";
import { CANCELLED_COOKIE, type Reservation } from "./reservation";
import { isMockMode } from "./mode";

// The account's bookings, points and quote requests as the server pages read them. The session is a
// sample one while sign-in is not connected (lib/session.ts), so with USE_MOCKS=1 the sample data is
// shown, with the bookings this browser has cancelled applied (the sample data is fixed, so a
// cancellation is kept in a cookie). Otherwise these are `GET /me/reservations`, `/me/points` and
// `/me/quotes`, which see the visitor through the session cookie. They live here, not in
// account-client.ts, because that file is imported by client components and these need the request.
async function cancelledIds(): Promise<string[]> {
  return ((await cookies()).get(CANCELLED_COOKIE)?.value ?? "").split(",").filter(Boolean);
}

export async function getMyReservations(): Promise<Reservation[]> {
  if (!isMockMode()) return fetchMyReservations();
  return (await import("@/mocks/reservations")).withCancelled(await cancelledIds());
}

export async function getMyPoints(): Promise<PointsAccount> {
  if (!isMockMode()) return fetchMyPoints();
  const { mockPoints, withCancelled } = await import("@/mocks/reservations");
  return mockPoints(new Date(), withCancelled(await cancelledIds()));
}

export async function getMyQuoteRequests(): Promise<QuoteRequest[]> {
  if (!isMockMode()) return fetchMyQuoteRequests();
  return (await import("@/mocks/quotes")).MOCK_QUOTE_REQUESTS;
}

// Where the account is signed in. The sample account has this browser and one phone, until the others are closed.
export async function getMySessions(): Promise<AccountSession[]> {
  if (!isMockMode()) return fetchMySessions();
  const now = Date.now();
  const revoked = (await cookies()).get(SESSIONS_REVOKED_COOKIE)?.value === "1";
  const iso = (ms: number) => new Date(ms).toISOString();
  return [
    { id: "this", current: true, device: "Chrome · Windows", createdAt: iso(now), expiresAt: iso(now + 30 * 86_400_000) },
    ...(revoked
      ? []
      : [{ id: "phone", current: false, device: "Safari · iPhone", createdAt: iso(now - 2 * 86_400_000), expiresAt: iso(now + 28 * 86_400_000) }]),
  ];
}
