import "server-only";
import { cookies } from "next/headers";
import * as client from "./account-client";
import type { PointsAccount } from "./points";
import { CANCELLED_COOKIE, type Reservation } from "./reservation";

// The account's bookings and points as the server pages read them: the same calls as
// account-client.ts, with the bookings this browser has cancelled applied (the sample data is
// fixed, so a cancellation is kept in a cookie; USE_MOCKS=1 only, the real API will know).
async function cancelledIds(): Promise<string[]> {
  return ((await cookies()).get(CANCELLED_COOKIE)?.value ?? "").split(",").filter(Boolean);
}

export async function getMyReservations(): Promise<Reservation[]> {
  return client.getMyReservations(await cancelledIds());
}

export async function getMyPoints(): Promise<PointsAccount> {
  return client.getMyPoints(await cancelledIds());
}
