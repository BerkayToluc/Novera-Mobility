import { describe, expect, it } from "vitest";
import type { OpeningHours } from "@/lib/branch-detail";
import { openingStatus } from "@/lib/opening-status";

// Turkey is UTC+3 all year (no daylight saving since 2016), so 2026-12-14T09:00 UTC is 12:00 there.
const at = (iso: string) => new Date(iso);

const OFFICE: OpeningHours = {
  weekdays: { open: "08:00", close: "20:00" },
  saturday: { open: "09:00", close: "18:00" },
  sunday: null,
};
const AIRPORT: OpeningHours = {
  weekdays: { open: "00:00", close: "24:00" },
  saturday: { open: "00:00", close: "24:00" },
  sunday: { open: "00:00", close: "24:00" },
};

describe("openingStatus", () => {
  it("says an airport that never closes is always open", () => {
    expect(openingStatus(AIRPORT, at("2026-12-14T21:30:00Z"))).toEqual({ state: "always" });
  });

  it("is open between opening and closing, and says until when", () => {
    // Monday 14 December 2026, 12:00 in Turkey
    expect(openingStatus(OFFICE, at("2026-12-14T09:00:00Z"))).toEqual({ state: "open", until: "20:00" });
  });

  it("is open at the minute it opens and closed at the minute it closes", () => {
    expect(openingStatus(OFFICE, at("2026-12-14T05:00:00Z")).state).toBe("open"); // 08:00 Istanbul
    expect(openingStatus(OFFICE, at("2026-12-14T17:00:00Z")).state).toBe("closed"); // 20:00 Istanbul
  });

  it("before opening says it opens later today", () => {
    // Monday 06:00 in Turkey
    expect(openingStatus(OFFICE, at("2026-12-14T03:00:00Z"))).toEqual({
      state: "closed",
      opensAt: "08:00",
      daysAhead: 0,
      weekday: 1,
    });
  });

  it("after closing says it opens tomorrow", () => {
    // Monday 22:00 in Turkey
    expect(openingStatus(OFFICE, at("2026-12-14T19:00:00Z"))).toMatchObject({ state: "closed", opensAt: "08:00", daysAhead: 1, weekday: 2 });
  });

  it("on Saturday after closing, skips the closed Sunday and says Monday", () => {
    // Saturday 19 December 2026, 19:00 in Turkey
    expect(openingStatus(OFFICE, at("2026-12-19T16:00:00Z"))).toMatchObject({ state: "closed", opensAt: "08:00", daysAhead: 2, weekday: 1 });
  });

  it("closed all day on Sunday, opening Monday", () => {
    // Sunday 20 December 2026, 12:00 in Turkey
    expect(openingStatus(OFFICE, at("2026-12-20T09:00:00Z"))).toMatchObject({ state: "closed", opensAt: "08:00", daysAhead: 1, weekday: 1 });
  });

  it("reads Turkey's clock, not the machine's: late Sunday evening UTC is already Monday in Turkey", () => {
    // 2026-12-20T22:00Z is Monday 01:00 in Turkey: before the 08:00 opening, same day
    expect(openingStatus(OFFICE, at("2026-12-20T22:00:00Z"))).toMatchObject({ state: "closed", opensAt: "08:00", daysAhead: 0, weekday: 1 });
  });

  it("a branch open all day on only some days is not 'always'", () => {
    const hours: OpeningHours = { ...AIRPORT, sunday: null };
    expect(openingStatus(hours, at("2026-12-14T09:00:00Z"))).toEqual({ state: "open", until: "24:00" });
  });

  it("a branch with no hours at all is closed for good", () => {
    expect(openingStatus({ weekdays: null, saturday: null, sunday: null }, at("2026-12-14T09:00:00Z"))).toEqual({ state: "closed-for-good" });
  });
});
