import { describe, expect, it } from "vitest";
import { ADMIN_SCREENS } from "@/lib/admin-screens";
import { SUMMARY_CARDS, shownCards, summaryIsEmpty } from "@/lib/admin-summary";
import type { AdminSummary } from "@/lib/api-admin";

const summary = (overrides: Partial<AdminSummary> = {}): AdminSummary => ({
  date: "2026-10-29",
  rentalsStartingToday: 0,
  rentalsEndingToday: 0,
  reservationsLast7Days: 0,
  quotesAwaiting: 0,
  unhandledMessages: null,
  serviceRequests: null,
  ...overrides,
});

describe("the summary cards (V2-25)", () => {
  it("leaves out a card whose number has no source yet, instead of showing a zero", () => {
    expect(shownCards(summary()).map((card) => card.key)).toEqual([
      "rentalsStartingToday",
      "rentalsEndingToday",
      "reservationsLast7Days",
      "quotesAwaiting",
    ]);
    expect(shownCards(summary({ unhandledMessages: 0 })).map((card) => card.key)).toContain("unhandledMessages");
  });

  it("is all clear only when every shown card is zero; a missing number does not count as one", () => {
    expect(summaryIsEmpty(summary())).toBe(true);
    expect(summaryIsEmpty(summary({ quotesAwaiting: 1 }))).toBe(false);
    expect(summaryIsEmpty(summary({ reservationsLast7Days: 5 }))).toBe(false);
    // A card that appears later (V2-32) with something in it ends the all-clear.
    expect(summaryIsEmpty(summary({ unhandledMessages: 2 }))).toBe(false);
  });

  it("every card points at a screen that is in the panel's list, so turning one on needs no change here", () => {
    const keys = new Set(ADMIN_SCREENS.map((screen) => screen.key));
    for (const card of SUMMARY_CARDS) expect(keys.has(card.screen), card.key).toBe(true);
  });
});
