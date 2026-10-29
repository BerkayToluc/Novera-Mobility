import { describe, expect, it } from "vitest";
import { hrefQuery, pageCount, parseAdminListParams, toApiQuery, type AdminListConfig } from "../lib/admin-query";

// The address of a panel list and the API query built from it (V2-24, ADMIN.md §3.4).
const config = {
  sortable: ["createdAt", "number"],
  defaultSort: { key: "createdAt", dir: "desc" },
  filters: { durum: ["CONFIRMED", "CANCELLED"], sehir: null },
} satisfies AdminListConfig<"durum" | "sehir">;

describe("parseAdminListParams", () => {
  it("reads the page, sort, search and filters from the address", () => {
    const params = parseAdminListParams({ sayfa: "3", sirala: "number:asc", ara: "  ayşe   yılmaz ", durum: "CANCELLED", sehir: "İzmir" }, config);
    expect(params).toEqual({ page: 3, pageSize: 20, sort: { key: "number", dir: "asc" }, q: "ayşe yılmaz", filters: { durum: "CANCELLED", sehir: "İzmir" } });
  });

  it("falls back to the defaults for anything that is not allowed, instead of passing it on", () => {
    const params = parseAdminListParams(
      { sayfa: "-2", sirala: "passwordHash:asc", ara: "x".repeat(500), durum: "DROP TABLE", sehir: "" },
      config,
    );
    expect(params.page).toBe(1);
    expect(params.sort).toEqual({ key: "createdAt", dir: "desc" });
    expect(params.q).toHaveLength(100);
    expect(params.filters).toEqual({});
  });

  it.each(["abc", "1.5", "0", "", "99999999999", "1e3"])("a page of %j is page 1 or a bounded number", (value) => {
    const { page } = parseAdminListParams({ sayfa: value }, config);
    expect(page).toBeGreaterThanOrEqual(1);
    expect(page).toBeLessThanOrEqual(100_000);
    if (!/^\d{1,6}$/.test(value) || Number(value) < 1) expect(page).toBe(1);
  });

  it("takes the first of a repeated value, and works on URLSearchParams too", () => {
    expect(parseAdminListParams({ durum: ["CONFIRMED", "CANCELLED"] }, config).filters).toEqual({ durum: "CONFIRMED" });
    expect(parseAdminListParams(new URLSearchParams("sayfa=2&durum=CONFIRMED"), config)).toMatchObject({ page: 2, filters: { durum: "CONFIRMED" } });
  });

  it("never allows a page size over 100", () => {
    expect(parseAdminListParams({}, { ...config, pageSize: 5000 }).pageSize).toBe(100);
    expect(parseAdminListParams({}, { ...config, pageSize: 0 }).pageSize).toBe(1);
  });

  it("has no sort when the list has no default and none is given", () => {
    expect(parseAdminListParams({}, { sortable: ["a"] }).sort).toBeNull();
  });
});

describe("toApiQuery", () => {
  it("uses the API's names and only what was set", () => {
    const params = parseAdminListParams({ sayfa: "2", sirala: "number:asc", durum: "CONFIRMED" }, config);
    expect(toApiQuery(params, { durum: "status" }).toString()).toBe("page=2&pageSize=20&sort=number%3Aasc&status=CONFIRMED");
    const plain = parseAdminListParams({}, { sortable: [], pageSize: 50 });
    expect(toApiQuery(plain).toString()).toBe("page=1&pageSize=50");
  });
});

describe("hrefQuery", () => {
  const current = parseAdminListParams({ sayfa: "3", durum: "CONFIRMED", ara: "ayşe" }, config);

  it("a change of page keeps everything else, and page 1 is not written", () => {
    expect(hrefQuery(current, { page: 4 }, config)).toEqual({ sayfa: "4", durum: "CONFIRMED", ara: "ayşe" });
    expect(hrefQuery(current, { page: 1 }, config)).toEqual({ durum: "CONFIRMED", ara: "ayşe" });
  });

  it("any other change starts again from page 1", () => {
    expect(hrefQuery(current, { filters: { durum: "CANCELLED" } }, config)).toEqual({ durum: "CANCELLED", ara: "ayşe" });
    expect(hrefQuery(current, { q: "mert" }, config)).toEqual({ durum: "CONFIRMED", ara: "mert" });
    expect(hrefQuery(current, { sort: { key: "number", dir: "asc" } }, config)).toEqual({ sirala: "number:asc", durum: "CONFIRMED", ara: "ayşe" });
  });

  it("removes a filter with null, and leaves the default sort out", () => {
    expect(hrefQuery(current, { filters: { durum: null } }, config)).toEqual({ ara: "ayşe" });
    expect(hrefQuery(current, { sort: { key: "createdAt", dir: "desc" } }, config)).toEqual({ durum: "CONFIRMED", ara: "ayşe" });
  });
});

describe("pageCount", () => {
  it("is at least one", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
  });
});
