import { describe, expect, it } from "vitest";
import { adminPhase, cancelFormSchema, MAX_REASON, validDay } from "@/lib/admin-reservations";
import { codeMessages, invalidFields } from "@/lib/validation";
import { cancelMockReservation, getMockAdminReservation, listMockAdminReservations } from "@/mocks/admin-reservations";
import { withCancelled } from "@/mocks/reservations";
import { fleetOf } from "@/mocks/fleet-world";

// The sample store is kept per world (lib/mock-world.ts); every test has one of its own. The sample bookings are worked out from
// the time of the call, so each test fixes `now` and reads the same ones.
const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
const everyList = { page: 1, pageSize: 100, sort: null, q: "", status: null, branch: null, from: null, to: null };
const CLIO = "NVR-2026-00207"; // two days ahead, picks up at Ankara
const PASSAT = "NVR-2026-00231"; // a month ahead
const DONE = "NVR-2026-00142"; // finished
const CANCELLED = "NVR-2026-00098"; // cancelled by the customer

describe("the days of a filter (V2-31)", () => {
  it("only a real day is a day", () => {
    expect(validDay("2026-10-30")).toBe("2026-10-30");
    expect(validDay("2026-02-30")).toBeUndefined();
    expect(validDay("2026-13-01")).toBeUndefined();
    expect(validDay("yarın")).toBeUndefined();
    expect(validDay("1999-01-01")).toBeUndefined();
    expect(validDay(undefined)).toBeUndefined();
  });
});

describe("where a booking is in its life", () => {
  const row = (status: "CONFIRMED" | "CANCELLED", start: number, end: number) => ({ status, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() });
  it("is ahead, under way, finished or cancelled", () => {
    expect(adminPhase(row("CONFIRMED", NOW + 1000, NOW + 2000), NOW)).toBe("UPCOMING");
    expect(adminPhase(row("CONFIRMED", NOW - 1000, NOW + 1000), NOW)).toBe("ACTIVE");
    expect(adminPhase(row("CONFIRMED", NOW - 2000, NOW - 1000), NOW)).toBe("COMPLETED");
    expect(adminPhase(row("CANCELLED", NOW + 1000, NOW + 2000), NOW)).toBe("CANCELLED");
  });
});

describe("the reason of a cancellation", () => {
  const schema = cancelFormSchema(codeMessages());
  it("is 5 to 500 characters once trimmed", () => {
    expect(schema.safeParse({ reason: "  Müşteri istedi " }).success).toBe(true);
    const short = schema.safeParse({ reason: "kısa" });
    expect(short.success ? [] : invalidFields(short.error)).toEqual(["reason"]);
    expect(schema.safeParse({ reason: "     " }).success).toBe(false);
    expect(schema.safeParse({ reason: "x".repeat(MAX_REASON) }).success).toBe(true);
    expect(schema.safeParse({ reason: "x".repeat(MAX_REASON + 1) }).success).toBe(false);
  });
});

describe("the sample bookings in the panel", () => {
  it("are the five of the sample account, newest start first, each with its customer, car and branches", () => {
    const list = listMockAdminReservations("unit-res-seed", everyList, NOW);
    expect(list.total).toBe(5);
    expect(list.items.map((row) => row.number)).toEqual([PASSAT, CLIO, DONE, CANCELLED, "NVR-2026-00031"]);
    const clio = list.items.find((row) => row.number === CLIO)!;
    expect(clio).toMatchObject({ status: "CONFIRMED", customer: { email: "elif.yildiz@example.com" }, vehicle: { brand: "Renault", model: "Clio" }, pickupBranch: { id: "ankara-esenboga" } });
    expect(clio.vehicle.plate).toMatch(/^\d{2} [A-Z]{2} \d{4}$/);
  });

  it("narrow by state, pick-up branch, days the rental starts on, and a part of the number or e-mail", () => {
    const world = "unit-res-filter";
    expect(listMockAdminReservations(world, { ...everyList, status: "CANCELLED" }, NOW).items.map((row) => row.number)).toEqual([CANCELLED]);
    expect(listMockAdminReservations(world, { ...everyList, branch: "ankara-esenboga" }, NOW).items.map((row) => row.number)).toEqual([CLIO]);
    expect(listMockAdminReservations(world, { ...everyList, q: "00231" }, NOW).items.map((row) => row.number)).toEqual([PASSAT]);
    expect(listMockAdminReservations(world, { ...everyList, q: "ELIF.YILDIZ" }, NOW).total).toBe(5);
    expect(listMockAdminReservations(world, { ...everyList, q: "kimse@" }, NOW).total).toBe(0);
    // Two days after "now" is the 1st of November; both days of the range are included.
    expect(listMockAdminReservations(world, { ...everyList, from: "2026-11-01", to: "2026-11-01" }, NOW).items.map((row) => row.number)).toEqual([CLIO]);
    expect(listMockAdminReservations(world, { ...everyList, from: "2026-11-02", to: "2026-12-31" }, NOW).items.map((row) => row.number)).toEqual([PASSAT]);
  });

  it("says whether a booking can be cancelled: only one that is ahead", () => {
    const world = "unit-res-cancellable";
    expect(getMockAdminReservation(world, CLIO, NOW)?.cancellable).toBe(true);
    expect(getMockAdminReservation(world, DONE, NOW)?.cancellable).toBe(false);
    expect(getMockAdminReservation(world, CANCELLED, NOW)?.cancellable).toBe(false);
    expect(getMockAdminReservation(world, CLIO.toLowerCase(), NOW)?.number).toBe(CLIO);
    expect(getMockAdminReservation(world, "NVR-0000-00000", NOW)).toBeNull();
  });

  it("a cancellation needs a reason, is for a booking that is ahead, and shows in the panel and in the customer list", () => {
    const world = "unit-res-cancel";
    expect(cancelMockReservation(world, CLIO, "kısa", NOW)).toEqual({ status: "invalid", fields: { reason: "TOO_SHORT" } });
    expect(cancelMockReservation(world, DONE, "Başlamış kiralama", NOW)).toEqual({ status: "not_cancellable" });
    expect(cancelMockReservation(world, "NVR-0000-00000", "Olmayan rezervasyon", NOW)).toEqual({ status: "not_found" });
    expect(getMockAdminReservation(world, CLIO, NOW)?.status).toBe("CONFIRMED");

    expect(cancelMockReservation(world, CLIO, "  Müşteri aradı, istemiyor  ", NOW)).toEqual({ status: "ok" });
    const after = getMockAdminReservation(world, CLIO, NOW)!;
    expect(after).toMatchObject({ status: "CANCELLED", cancellable: false, pointsEarned: 0, cancellation: { reason: "Müşteri aradı, istemiyor", by: { name: "Deniz Yönetici" } } });
    // The second time it is already cancelled.
    expect(cancelMockReservation(world, CLIO, "İkinci iptal denemesi", NOW)).toEqual({ status: "not_cancellable" });
    // The customer's own list marks it, through the ids the world keeps.
    const ids = fleetOf(world).cancellations.map((entry) => entry.id);
    expect(withCancelled(ids, NOW).find((reservation) => reservation.number === CLIO)?.status).toBe("CANCELLED");
    // Another world never saw it.
    expect(getMockAdminReservation("unit-res-other", CLIO, NOW)?.status).toBe("CONFIRMED");
  });
});
