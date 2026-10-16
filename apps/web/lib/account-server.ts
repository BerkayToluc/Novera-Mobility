import "server-only";
import { cookies } from "next/headers";
import { fetchMyPoints, fetchMyQuoteRequests, fetchMyReservations } from "./api-account";
import type { PointsAccount } from "./points";
import type { QuoteRequest } from "./quote-request";
import { CANCELLED_COOKIE, type Reservation } from "./reservation";

// The account's bookings, points and quote requests as the server pages read them. The session is a
// sample one while sign-in is not connected (lib/session.ts), so with USE_MOCKS=1 the sample data is
// shown, with the bookings this browser has cancelled applied (the sample data is fixed, so a
// cancellation is kept in a cookie). Otherwise these are `GET /me/reservations`, `/me/points` and
// `/me/quotes`, which see the visitor through the session cookie. They live here, not in
// account-client.ts, because that file is imported by client components and these need the request.
const mocksEnabled = () => process.env.USE_MOCKS === "1";

async function cancelledIds(): Promise<string[]> {
  return ((await cookies()).get(CANCELLED_COOKIE)?.value ?? "").split(",").filter(Boolean);
}

export async function getMyReservations(): Promise<Reservation[]> {
  if (!mocksEnabled()) return fetchMyReservations();
  return (await import("@/mocks/reservations")).withCancelled(await cancelledIds());
}

export async function getMyPoints(): Promise<PointsAccount> {
  if (!mocksEnabled()) return fetchMyPoints();
  const { mockPoints, withCancelled } = await import("@/mocks/reservations");
  return mockPoints(new Date(), withCancelled(await cancelledIds()));
}

export async function getMyQuoteRequests(): Promise<QuoteRequest[]> {
  if (!mocksEnabled()) return fetchMyQuoteRequests();
  return (await import("@/mocks/quotes")).MOCK_QUOTE_REQUESTS;
}
