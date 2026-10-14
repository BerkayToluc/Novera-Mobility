"use server";

import { cookies } from "next/headers";
import { currentTime } from "@/lib/clock";
import { CANCELLED_COOKIE, reservationPhase } from "@/lib/reservation";
import { getSession } from "@/lib/session";

// The sample data is fixed, so a cancellation is kept in a cookie and applied when the bookings
// are read (USE_MOCKS=1 only). The real call is `POST /me/reservations/{id}/cancel`, which does not
// exist yet (BACKLOG).
export type CancelResult = { ok: true } | { ok: false; reason: "unavailable" | "not_cancellable" };

export async function cancelReservation(id: string): Promise<CancelResult> {
  if (process.env.USE_MOCKS !== "1") return { ok: false, reason: "unavailable" };
  if ((await getSession())?.type !== "individual") return { ok: false, reason: "unavailable" };

  const { MOCK_RESERVATIONS } = await import("@/mocks/reservations");
  const jar = await cookies();
  const already = (jar.get(CANCELLED_COOKIE)?.value ?? "").split(",").filter(Boolean);
  const reservation = MOCK_RESERVATIONS.find((entry) => entry.id === id);
  // Only a booking that is still ahead can be cancelled, and only once.
  if (!reservation || already.includes(id) || reservationPhase(reservation, currentTime()) !== "UPCOMING") {
    return { ok: false, reason: "not_cancellable" };
  }
  jar.set(CANCELLED_COOKIE, [...already, id].join(","), { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}
