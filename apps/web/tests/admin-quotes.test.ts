import { describe, expect, it } from "vitest";
import { MESSAGE_API_VALUES, MESSAGE_LIST } from "@/lib/admin-messages";
import { MAX_NOTE, nextStatuses, noteFormSchema, QUOTE_LIST, statusRank } from "@/lib/admin-quotes";
import { parseAdminListParams } from "@/lib/admin-query";
import { SUMMARY_CARDS } from "@/lib/admin-summary";
import { codeMessages } from "@/lib/validation";
import { getMockMessage, handleMockMessage, listMockMessages, waitingMessages } from "@/mocks/admin-messages";
import { getMockQuote, listMockQuotes, mockQuoteRequestsFor, updateMockQuote } from "@/mocks/admin-quotes";
import { MOCK_ADMIN_SUMMARY } from "@/mocks/admin";

// The sample store is kept per world (lib/mock-world.ts); every test has one of its own.
const quoteList = { page: 1, pageSize: 100, sort: null, q: "", status: null, source: null };
const messageList = { page: 1, pageSize: 100, sort: null, q: "", handled: null };
const WAITING = "TKL-2026-50111";
const REVIEWING = "TKL-2026-48213";
const OFFERED = "TKL-2026-31870";
const ADMIN = { name: "Deniz Yönetici", email: "yonetici@novera.example" };

describe("the order a quote goes through (V2-32)", () => {
  it("only goes forward, and says which states are left", () => {
    expect(statusRank("RECEIVED")).toBeLessThan(statusRank("IN_REVIEW"));
    expect(statusRank("OFFERED")).toBeLessThan(statusRank("CLOSED"));
    expect(nextStatuses("RECEIVED")).toEqual(["IN_REVIEW", "OFFERED", "CLOSED"]);
    expect(nextStatuses("OFFERED")).toEqual(["CLOSED"]);
    expect(nextStatuses("CLOSED")).toEqual([]);
  });

  it("the note is at most 2000 characters once trimmed, and an empty one is allowed (it clears the note)", () => {
    const schema = noteFormSchema(codeMessages());
    expect(schema.safeParse({ note: "" }).success).toBe(true);
    expect(schema.safeParse({ note: "x".repeat(MAX_NOTE) }).success).toBe(true);
    expect(schema.safeParse({ note: "x".repeat(MAX_NOTE + 1) }).success).toBe(false);
  });
});

describe("the addresses of the lists", () => {
  it("the summary cards open lists whose filters the lists read", () => {
    const quotes = SUMMARY_CARDS.find((card) => card.key === "quotesAwaiting")!;
    expect(parseAdminListParams(new URLSearchParams(quotes.filter), QUOTE_LIST).filters).toEqual({ durum: "RECEIVED" });
    const messages = SUMMARY_CARDS.find((card) => card.key === "unhandledMessages")!;
    expect(parseAdminListParams(new URLSearchParams(messages.filter), MESSAGE_LIST).filters).toEqual({ durum: "ele-alinmadi" });
    expect(MESSAGE_API_VALUES["ele-alinmadi"]).toBe("false");
  });

  it("a state that is not one falls back to the whole list", () => {
    expect(parseAdminListParams(new URLSearchParams({ durum: "GONE", kaynak: "MAIL" }), QUOTE_LIST).filters).toEqual({});
    expect(parseAdminListParams(new URLSearchParams({ durum: "belki" }), MESSAGE_LIST).filters).toEqual({});
  });
});

describe("the sample quote requests", () => {
  it("are nine, newest first, and three of them wait, as many as the sample summary says", () => {
    const list = listMockQuotes("unit-quotes-seed", quoteList);
    expect(list.total).toBe(9);
    const times = list.items.map((item) => item.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(list.items.filter((item) => item.status === "RECEIVED")).toHaveLength(MOCK_ADMIN_SUMMARY.quotesAwaiting);
  });

  it("narrow by state, source and a part of the number, the company or the e-mail", () => {
    const world = "unit-quotes-filter";
    expect(listMockQuotes(world, { ...quoteList, status: "RECEIVED" }).total).toBe(3);
    expect(listMockQuotes(world, { ...quoteList, source: "FLEET_RENEWAL" }).items.map((item) => item.number)).toEqual(["TKL-2026-50090"]);
    expect(listMockQuotes(world, { ...quoteList, q: "50111" }).items.map((item) => item.number)).toEqual([WAITING]);
    expect(listMockQuotes(world, { ...quoteList, q: "ANADOLU" }).total).toBeGreaterThanOrEqual(1);
    expect(listMockQuotes(world, { ...quoteList, q: "kimse@" }).total).toBe(0);
  });

  it("move forward with the version, skip ahead, and never go back", () => {
    const world = "unit-quotes-move";
    const first = getMockQuote(world, WAITING)!;
    expect(updateMockQuote(world, WAITING, { updatedAt: "old", status: "CLOSED" }).status).toBe("stale");
    const closed = updateMockQuote(world, WAITING, { updatedAt: first.updatedAt, status: "CLOSED" });
    expect(closed).toMatchObject({ status: "ok", value: { status: "CLOSED", nextStatuses: [] } });
    // A step back is refused, and so is the note sent with it.
    const back = updateMockQuote(world, WAITING, { updatedAt: getMockQuote(world, WAITING)!.updatedAt, status: "IN_REVIEW", internalNote: "Geri almak istedim" });
    expect(back.status).toBe("invalid_transition");
    expect(getMockQuote(world, WAITING)?.internalNote).toBeNull();
    expect(updateMockQuote(world, "TKL-0000-00000", { updatedAt: "x" }).status).toBe("not_found");
  });

  it("the note is written, trimmed, cleared, and capped", () => {
    const world = "unit-quotes-note";
    const start = getMockQuote(world, REVIEWING)!;
    const written = updateMockQuote(world, REVIEWING, { updatedAt: start.updatedAt, internalNote: "  Cuma aranacak.  " });
    expect(written).toMatchObject({ status: "ok", value: { internalNote: "Cuma aranacak.", status: "IN_REVIEW" } });
    const cleared = updateMockQuote(world, REVIEWING, { updatedAt: getMockQuote(world, REVIEWING)!.updatedAt, internalNote: "   " });
    expect(cleared).toMatchObject({ status: "ok", value: { internalNote: null } });
    expect(updateMockQuote(world, REVIEWING, { updatedAt: getMockQuote(world, REVIEWING)!.updatedAt, internalNote: "x".repeat(2001) })).toEqual({ status: "invalid", fields: { internalNote: "TOO_LONG" } });
  });

  it("show the corporate sample account its three requests in the state the panel left them, and never the note", () => {
    const world = "unit-quotes-customer";
    expect(mockQuoteRequestsFor(world).map((request) => request.status)).toEqual(["IN_REVIEW", "OFFERED", "OFFERED"]);
    const start = getMockQuote(world, REVIEWING)!;
    updateMockQuote(world, REVIEWING, { updatedAt: start.updatedAt, status: "OFFERED", internalNote: "Gizli not" });
    const seen = mockQuoteRequestsFor(world);
    expect(seen.find((request) => request.reference === REVIEWING)?.status).toBe("OFFERED");
    expect(JSON.stringify(seen)).not.toContain("Gizli not");
    // Another world never saw it.
    expect(mockQuoteRequestsFor("unit-quotes-other").find((request) => request.reference === REVIEWING)?.status).toBe("IN_REVIEW");
    expect(getMockQuote(world, OFFERED)?.internalNote).toBe("İndirim payı %8, müdür onayladı.");
  });
});

describe("the sample contact messages", () => {
  it("are six, and four wait, as many as the sample summary says; the erased one does not wait", () => {
    const world = "unit-messages-seed";
    expect(listMockMessages(world, messageList).total).toBe(6);
    expect(waitingMessages(world)).toBe(MOCK_ADMIN_SUMMARY.unhandledMessages);
    const waiting = listMockMessages(world, { ...messageList, handled: false });
    expect(waiting.total).toBe(4);
    expect(waiting.items.some((item) => item.anonymized)).toBe(false);
    expect(listMockMessages(world, { ...messageList, handled: true }).items.map((item) => item.id)).toEqual(["m5"]);
  });

  it("search the name, the e-mail and the subject; a list shows a preview and the page the whole text", () => {
    const world = "unit-messages-search";
    expect(listMockMessages(world, { ...messageList, q: "mehmet" }).items.map((item) => item.id)).toEqual(["m2"]);
    expect(listMockMessages(world, { ...messageList, q: "fatura" }).items.map((item) => item.id)).toEqual(["m5"]);
    const item = listMockMessages(world, messageList).items.find((entry) => entry.id === "m1")!;
    expect(Object.keys(item)).not.toContain("message");
    expect(getMockMessage(world, "m1")?.message).toContain("Kasım ayında teslim gerekiyor");
  });

  it("are marked handled with the person and the time, keep the first mark, and the mark is taken back", () => {
    const world = "unit-messages-mark";
    const first = new Date("2026-10-30T10:00:00Z");
    const marked = handleMockMessage(world, "m1", true, ADMIN, first);
    expect(marked).toMatchObject({ status: "ok", value: { handledAt: first.toISOString(), handledBy: ADMIN } });
    const again = handleMockMessage(world, "m1", true, { name: "Başkası", email: "baska@example.com" }, new Date("2026-11-01T10:00:00Z"));
    expect(again).toMatchObject({ value: { handledAt: first.toISOString(), handledBy: ADMIN } });
    expect(waitingMessages(world)).toBe(3);
    expect(handleMockMessage(world, "m1", false, ADMIN)).toMatchObject({ value: { handledAt: null, handledBy: null } });
    expect(waitingMessages(world)).toBe(4);
    expect(handleMockMessage(world, "yok", true, ADMIN).status).toBe("not_found");
  });
});
