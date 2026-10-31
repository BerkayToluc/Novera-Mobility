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
  unhandledMessages: 0,
  serviceRequests: 0,
  ...overrides,
});

describe("the summary cards (V2-25)", () => {
  it("shows every card now that every number has a source (the service requests came with V2-41)", () => {
    expect(shownCards(summary()).map((card) => card.key)).toEqual([
      "rentalsStartingToday",
      "rentalsEndingToday",
      "reservationsLast7Days",
      "quotesAwaiting",
      "unhandledMessages",
      "serviceRequests",
    ]);
  });

  it("still leaves out a card whose number is missing, instead of showing a wrong zero", () => {
    // A number that is null has no source: the screen does not guess. (The API gives a number for all of them now.)
    const missing = summary({ serviceRequests: null as unknown as number });
    expect(shownCards(missing).map((card) => card.key)).not.toContain("serviceRequests");
    expect(summaryIsEmpty(missing)).toBe(true);
  });

  it("is all clear only when every shown card is zero; a missing number does not count as one", () => {
    expect(summaryIsEmpty(summary())).toBe(true);
    expect(summaryIsEmpty(summary({ quotesAwaiting: 1 }))).toBe(false);
    expect(summaryIsEmpty(summary({ reservationsLast7Days: 5 }))).toBe(false);
    expect(summaryIsEmpty(summary({ unhandledMessages: 2 }))).toBe(false);
    // An open service request (V2-41) ends the all-clear too.
    expect(summaryIsEmpty(summary({ serviceRequests: 1 }))).toBe(false);
  });

  it("every card points at a screen that is in the panel's list, so turning one on needs no change here", () => {
    const keys = new Set(ADMIN_SCREENS.map((screen) => screen.key));
    for (const card of SUMMARY_CARDS) expect(keys.has(card.screen), card.key).toBe(true);
  });
});
