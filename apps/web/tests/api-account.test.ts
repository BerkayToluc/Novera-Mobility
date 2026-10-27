import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelMyReservation, fetchMyPoints, fetchMyQuoteRequests, fetchMyReceipt, fetchMyReservations } from "../lib/api-account";
import { pointsFromApi, quoteFromApi, reservationFromApi } from "../lib/api-mappers";
import type { components } from "../lib/api-types";
import type { BookingData } from "../lib/booking-data";
import { VehicleUnavailableError } from "../lib/hold-client";
import { resetPassword } from "../lib/password-reset-actions";
import {
  createReservation,
  PastStartError,
  PromoCodeError,
  ReservationLimitError,
  ReservationRateLimitedError,
  reservationToApi,
} from "../lib/reservation-client";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
  cookies: async () => ({ get: (name: string) => (name === "novera_session" ? { value: "abc" } : undefined) }),
}));

type Schemas = components["schemas"];

const apiReservation = {
  id: "7b2f6d0e-1c3a-4a53-9d5e-0d2a8c1f4b11",
  number: "NVR-2026-00123",
  status: "CONFIRMED",
  vehicle: { id: "v1", model: { brand: "Toyota", model: "Corolla Hybrid" } },
  pickupBranch: { id: "b1", name: "İstanbul Kadıköy", city: "İstanbul" },
  returnBranch: { id: "b2", name: "İzmir Havalimanı", city: "İzmir" },
  startAt: "2026-12-14T07:00:00Z",
  endAt: "2026-12-17T07:00:00Z",
  price: { currency: "TRY", exchangeRate: 1, days: 3, lines: [], total: { amount: 486000, currency: "TRY" } },
  pointsEarned: 48,
  createdAt: "2026-10-12T10:00:00Z",
} as unknown as Schemas["Reservation"];

describe("mapping the API's answers", () => {
  it("flattens a reservation", () => {
    expect(reservationFromApi(apiReservation)).toEqual({
      id: apiReservation.id,
      number: "NVR-2026-00123",
      status: "CONFIRMED",
      startAt: "2026-12-14T07:00:00Z",
      endAt: "2026-12-17T07:00:00Z",
      days: 3,
      totalPrice: { amount: 486000, currency: "TRY" },
      vehicle: { brand: "Toyota", model: "Corolla Hybrid" },
      pickupCity: "İstanbul",
      returnCity: "İzmir",
      pickupBranchId: "b1",
      returnBranchId: "b2",
      pointsEarned: 48,
    });
  });

  it("reads the points history by `history` and `createdAt`, and keeps a missing number as null", () => {
    const points = {
      balance: 10,
      pending: 5,
      history: [
        { points: 10, reservationNumber: "NVR-2026-00001", createdAt: "2026-08-09T08:30:00Z" },
        { points: 2, createdAt: "2026-08-10T08:30:00Z" },
      ],
      rules: { tr: "", en: "" },
    } as Schemas["Points"];
    expect(pointsFromApi(points)).toEqual({
      balance: 10,
      pending: 5,
      history: [
        { points: 10, reservationNumber: "NVR-2026-00001", createdAt: "2026-08-09T08:30:00Z" },
        { points: 2, reservationNumber: null, createdAt: "2026-08-10T08:30:00Z" },
      ],
    });
  });

  it("renames a quote's fields", () => {
    expect(
      quoteFromApi({
        id: "q1",
        number: "TKL-2026-00042",
        createdAt: "2026-10-02T09:30:00Z",
        vehicleCount: 10,
        durationMonths: 24,
        status: "IN_REVIEW",
      }),
    ).toEqual({
      id: "q1",
      reference: "TKL-2026-00042",
      sentAt: "2026-10-02T09:30:00Z",
      vehicleCount: 10,
      durationMonths: 24,
      status: "IN_REVIEW",
    });
  });
});

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe("calls to the API", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("USE_MOCKS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads the bookings with the visitor's session cookie", async () => {
    const fetchMock = respond(200, [apiReservation]);
    vi.stubGlobal("fetch", fetchMock);
    const bookings = await fetchMyReservations();
    expect(bookings).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/me/reservations");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ Cookie: "novera_session=abc", "X-Novera-Client-IP": "203.0.113.7" });
    expect(init.headers).not.toHaveProperty("X-Novera-Key");
  });

  it("sends the shared key when API_ACCESS_KEY is set", async () => {
    vi.stubEnv("API_ACCESS_KEY", "secret");
    const fetchMock = respond(200, []);
    vi.stubGlobal("fetch", fetchMock);
    await fetchMyReservations();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ "X-Novera-Key": "secret" });
  });

  it("finds a reservation by its number for the confirmation, with the price as stored", async () => {
    const stored = {
      ...apiReservation,
      price: {
        currency: "TRY",
        exchangeRate: 1,
        days: 3,
        lines: [
          { type: "VEHICLE", slug: "toyota-corolla-hybrid", label: { tr: "Toyota", en: "Toyota" }, quantity: 3, unitPrice: { amount: 100000, currency: "TRY" }, total: { amount: 300000, currency: "TRY" } },
          { type: "EXTRA", slug: "wifi", label: { tr: "Wi-Fi", en: "Wi-Fi" }, quantity: 3, unitPrice: { amount: 8000, currency: "TRY" }, total: { amount: 24000, currency: "TRY" } },
        ],
        total: { amount: 324000, currency: "TRY" },
        promo: null,
        pointsUsed: 0,
        payable: { amount: 324000, currency: "TRY" },
      },
      vehicle: { id: "v1", model: { brand: "Toyota", model: "Corolla Hybrid", class: { slug: "e", name: { tr: "Ekonomik", en: "Economy" } } } },
    };
    vi.stubGlobal("fetch", respond(200, [{ ...stored, number: "NVR-2026-00999" }, stored]));
    const receipt = await fetchMyReceipt("NVR-2026-00123");
    expect(receipt).toMatchObject({
      number: "NVR-2026-00123",
      days: 3,
      pointsEarned: 48,
      vehicle: { brand: "Toyota", dailyPrice: { amount: 100000, currency: "TRY" } },
      pickup: { city: "İstanbul", name: "İstanbul Kadıköy" },
    });
    expect(receipt?.summary.total).toEqual({ amount: 324000, currency: "TRY" });
    expect(receipt?.summary.extraLines.map((line) => line.extra.name.tr)).toEqual(["Wi-Fi"]);
    expect(await fetchMyReceipt("NVR-2026-00001")).toBeNull();
  });

  it("has no receipt for a visitor who is not signed in, and fails when the API is down", async () => {
    vi.stubGlobal("fetch", respond(401, { code: "UNAUTHENTICATED" }));
    expect(await fetchMyReceipt("NVR-2026-00123")).toBeNull();
    vi.stubGlobal("fetch", respond(503));
    await expect(fetchMyReceipt("NVR-2026-00123")).rejects.toThrow();
  });

  it("throws, so the page shows its error state, when the API is not there or the session is gone", async () => {
    vi.stubGlobal("fetch", respond(401, { code: "UNAUTHENTICATED" }));
    await expect(fetchMyPoints()).rejects.toThrow();
    vi.stubGlobal("fetch", respond(503));
    await expect(fetchMyQuoteRequests()).rejects.toThrow();
  });

  it("cancels, and tells a booking that cannot be cancelled from a service that is down", async () => {
    const fetchMock = respond(200, { ...apiReservation, status: "CANCELLED" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await cancelMyReservation(apiReservation.id)).toBe("cancelled");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      `http://api.test/me/reservations/${apiReservation.id}/cancel`,
    );

    vi.stubGlobal("fetch", respond(409, { code: "RESERVATION_NOT_CANCELLABLE" }));
    expect(await cancelMyReservation(apiReservation.id)).toBe("not_cancellable");
    vi.stubGlobal("fetch", respond(404, { code: "NOT_FOUND" }));
    expect(await cancelMyReservation(apiReservation.id)).toBe("not_cancellable");
    vi.stubGlobal("fetch", respond(500));
    expect(await cancelMyReservation(apiReservation.id)).toBe("unavailable");
  });

  const booking = {
    booking: { search: { startAt: "2026-12-14T10:00", endAt: "2026-12-17T10:00" } },
    vehicle: { id: "v1" },
    pickup: { id: "b1" },
    dropoff: { id: "b2" },
    extras: [{ slug: "wifi" }],
    summary: { total: { amount: 486000, currency: "EUR" } },
    hold: { id: "h1" },
  } as unknown as BookingData;

  it("sends the campaign code only when it took something off", () => {
    const withCode = (applied: boolean) => ({ ...booking, promo: { code: "NOVERA10", applied } }) as unknown as BookingData;
    expect(reservationToApi(withCode(true))).toMatchObject({ promoCode: "NOVERA10" });
    expect(reservationToApi(withCode(false))).not.toHaveProperty("promoCode");
    expect(reservationToApi(booking)).not.toHaveProperty("promoCode");
  });

  it("turns a code the API no longer knows into its own error", async () => {
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { promoCode: "UNKNOWN_CODE" } }));
    await expect(createReservation(booking)).rejects.toBeInstanceOf(PromoCodeError);
  });

  it("turns a start that is no longer in the future into its own error", async () => {
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { startAt: "IN_PAST" } }));
    await expect(createReservation(booking)).rejects.toBeInstanceOf(PastStartError);
  });

  it("tells apart a code that is used up and a code this account already used", async () => {
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { promoCode: "CODE_EXHAUSTED" } }));
    await expect(createReservation(booking)).rejects.toMatchObject({ name: "PromoCodeError", problem: "exhausted" });
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { promoCode: "CODE_ALREADY_USED" } }));
    await expect(createReservation(booking)).rejects.toMatchObject({ name: "PromoCodeError", problem: "used" });
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { promoCode: "UNKNOWN_CODE" } }));
    await expect(createReservation(booking)).rejects.toMatchObject({ name: "PromoCodeError", problem: "unknown" });
  });

  it("turns the cap on upcoming reservations into its own error", async () => {
    vi.stubGlobal("fetch", respond(422, { code: "RESERVATION_LIMIT", message: "limit" }));
    await expect(createReservation(booking)).rejects.toBeInstanceOf(ReservationLimitError);
  });

  it("turns a refused rate into its own error", async () => {
    vi.stubGlobal("fetch", respond(429, { code: "RATE_LIMITED", message: "slow down" }));
    await expect(createReservation(booking)).rejects.toBeInstanceOf(ReservationRateLimitedError);
  });

  it("sends a booking in the contract's shape, with the times in UTC", () => {
    expect(reservationToApi(booking)).toEqual({
      vehicleId: "v1",
      pickupBranchId: "b1",
      returnBranchId: "b2",
      startAt: "2026-12-14T07:00:00Z",
      endAt: "2026-12-17T07:00:00Z",
      currency: "EUR",
      holdId: "h1",
      extras: [{ slug: "wifi", quantity: 1 }],
    });
  });

  it("returns the number the backend issued, and tells a car someone else got", async () => {
    vi.stubGlobal("fetch", respond(201, apiReservation));
    expect(await createReservation(booking)).toEqual({ number: "NVR-2026-00123" });
    vi.stubGlobal("fetch", respond(409, { code: "VEHICLE_UNAVAILABLE" }));
    await expect(createReservation(booking)).rejects.toBeInstanceOf(VehicleUnavailableError);
    vi.stubGlobal("fetch", respond(401, { code: "UNAUTHENTICATED" }));
    await expect(createReservation(booking)).rejects.not.toBeInstanceOf(VehicleUnavailableError);
  });

  it("resets a password: 204 is success, a spent link and a short password are told apart", async () => {
    vi.stubGlobal("fetch", respond(204));
    expect(await resetPassword("tok", "yeni-sifre-1")).toEqual({ ok: true });
    vi.stubGlobal("fetch", respond(422, { code: "RESET_TOKEN_INVALID" }));
    expect(await resetPassword("tok", "yeni-sifre-1")).toEqual({ ok: false, reason: "invalid_link" });
    vi.stubGlobal("fetch", respond(422, { code: "VALIDATION_FAILED", fieldErrors: { password: "TOO_SHORT" } }));
    expect(await resetPassword("tok", "yeni-sifre-1")).toEqual({ ok: false, reason: "too_short" });
    vi.stubGlobal("fetch", respond(429, { code: "RATE_LIMITED" }));
    expect(await resetPassword("tok", "yeni-sifre-1")).toEqual({ ok: false, reason: "rate_limited", retryAfter: null });
  });

  it("does not call the API for a password that is too short or a missing token", async () => {
    const fetchMock = respond(204);
    vi.stubGlobal("fetch", fetchMock);
    expect(await resetPassword("tok", "kisa")).toEqual({ ok: false, reason: "too_short" });
    expect(await resetPassword("", "yeni-sifre-1")).toEqual({ ok: false, reason: "invalid_link" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
