"use server";

import { cookies } from "next/headers";
import { cancelMyReservation } from "@/lib/api-account";
import { currentTime } from "@/lib/clock";
import { CANCELLED_COOKIE, reservationPhase } from "@/lib/reservation";
import { getSession } from "@/lib/session";

export type CancelResult = { ok: true } | { ok: false; reason: "unavailable" | "not_cancellable" };

// Cancels one of the signed-in visitor's bookings. With USE_MOCKS=1 the sample data is fixed, so a
// cancellation is kept in a cookie and applied when the bookings are read. Otherwise it is
// `POST /me/reservations/{id}/cancel`, which frees the car again and takes the points back; the API
// decides whether the booking can still be cancelled.
export async function cancelReservation(id: string): Promise<CancelResult> {
  if (process.env.USE_MOCKS !== "1") {
    const outcome = await cancelMyReservation(id);
    if (outcome === "cancelled") return { ok: true };
    return { ok: false, reason: outcome };
  }
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
