import { describe, expect, it } from "vitest";
import { parseBooking, toBookingQuery } from "@/lib/booking";

const search = { alis: "a", iade: "b", baslangic: "2026-10-12T10:00", bitis: "2026-10-14T10:00" };

describe("parseBooking", () => {
  it("needs a search and a car", () => {
    expect(parseBooking(search)).toBeNull();
    expect(parseBooking({ arac: "clio" })).toBeNull();
  });

  it("reads the car, the extras and the hold", () => {
    const booking = parseBooking({ ...search, arac: "clio", ek: "wifi,child-seat", tutma: "123.clio" });
    expect(booking).toMatchObject({ vehicleSlug: "clio", extraSlugs: ["wifi", "child-seat"], holdId: "123.clio" });
  });

  it("drops repeated and empty extras", () => {
    expect(parseBooking({ ...search, arac: "clio", ek: "wifi,,wifi" })?.extraSlugs).toEqual(["wifi"]);
  });

  it("has no hold when none is given", () => {
    expect(parseBooking({ ...search, arac: "clio" })).not.toHaveProperty("holdId");
  });
});

describe("toBookingQuery", () => {
  it("survives a round trip, hold included", () => {
    const booking = parseBooking({ ...search, arac: "clio", ek: "wifi", tutma: "9.clio" })!;
    expect(parseBooking(toBookingQuery(booking))).toEqual(booking);
  });

  it("leaves out empty extras and a missing hold", () => {
    const query = toBookingQuery(parseBooking({ ...search, arac: "clio" })!);
    expect(query).not.toHaveProperty("ek");
    expect(query).not.toHaveProperty("tutma");
  });
});
