import "server-only";
import { apiRequest } from "./api-request";
import { pointsFromApi, quoteFromApi, receiptFromApi, reservationFromApi, type Receipt } from "./api-mappers";
import type { components } from "./api-types";
import { ApiUnavailableError } from "./fleet-client";
import type { AccountSession } from "./account-sessions";
import type { PointsAccount } from "./points";
import type { QuoteRequest } from "./quote-request";
import type { Reservation } from "./reservation";

type Schemas = components["schemas"];

// The signed-in visitor's own data (openapi tag `me`). The session cookie travels with each call
// (api-request.ts). Anything but an answer, including a 401, throws: the pages show their error
// state and the retry link, and a visitor without a session never gets here (the page asks first).
export async function fetchMyReservations(): Promise<Reservation[]> {
  const result = await apiRequest<Schemas["Reservation"][]>("GET", "/me/reservations");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data.map(reservationFromApi);
}

export async function fetchMyPoints(): Promise<PointsAccount> {
  const result = await apiRequest<Schemas["Points"]>("GET", "/me/points");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return pointsFromApi(result.data);
}

export async function fetchMyQuoteRequests(): Promise<QuoteRequest[]> {
  const result = await apiRequest<Schemas["QuoteSummary"][]>("GET", "/me/quotes");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data.map(quoteFromApi);
}

export type CancelOutcome = "cancelled" | "not_cancellable" | "unavailable";

// `POST /me/reservations/{id}/cancel`: 200 with the cancelled booking (also when it already was),
// 404 for a booking that is not this account's or does not exist, 409 once the rental has begun.
export async function cancelMyReservation(id: string): Promise<CancelOutcome> {
  const result = await apiRequest<Schemas["Reservation"]>("POST", `/me/reservations/${encodeURIComponent(id)}/cancel`);
  if (result.status === "ok") return "cancelled";
  if (result.status === "not_found" || result.status === "conflict") return "not_cancellable";
  return "unavailable";
}

export async function fetchMySessions(): Promise<AccountSession[]> {
  const result = await apiRequest<Schemas["SessionInfo"][]>("GET", "/me/sessions");
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data.map((entry) => ({
    id: entry.id,
    current: entry.current,
    device: entry.device ?? null,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  }));
}

// The reservation with this number among the signed-in visitor's own, or null when there is none (a
// wrong number, someone else's, a visitor who is not signed in). There is no call for a single one.
export async function fetchMyReceipt(number: string): Promise<Receipt | null> {
  const result = await apiRequest<Schemas["Reservation"][]>("GET", "/me/reservations");
  if (result.status === "unauthorized") return null;
  if (result.status !== "ok") throw new ApiUnavailableError();
  const found = result.data.find((reservation) => reservation.number === number);
  return found ? receiptFromApi(found) : null;
}
