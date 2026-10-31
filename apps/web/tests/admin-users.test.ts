import { describe, expect, it } from "vitest";
import { AUDIT_API_FILTERS, AUDIT_ENTITIES, AUDIT_LIST, validActor } from "@/lib/admin-audit";
import { parseAdminListParams, toApiQuery } from "@/lib/admin-query";
import { USER_API_FILTERS, USER_LIST } from "@/lib/admin-users";
import { disableMockUser, enableMockUser, getMockUser, isMockUserDisabled, listMockAudit, listMockUsers, MOCK_ADMIN_ID } from "@/mocks/admin-users";
import { en, tr } from "../i18n/messages";

// The sample store is kept per world (lib/mock-world.ts); each test group has one of its own.
const first = { page: 1, pageSize: 20, sort: null, q: "", type: null, status: null };
const ELIF = "6a000000-0000-4000-8000-000000000002";
const MERT = "6a000000-0000-4000-8000-000000000004";
const CAN = "6a000000-0000-4000-8000-000000000006";

describe("the user list address (V2-34)", () => {
  it("sorts by date, e-mail or surname, filters by type and state, and ignores anything else", () => {
    expect(parseAdminListParams({}, USER_LIST).sort).toEqual({ key: "createdAt", dir: "desc" });
    expect(parseAdminListParams({ sirala: "email:asc" }, USER_LIST).sort).toEqual({ key: "email", dir: "asc" });
    expect(parseAdminListParams({ sirala: "passwordHash:asc" }, USER_LIST).sort).toEqual({ key: "createdAt", dir: "desc" });
    expect(parseAdminListParams({ tur: "CORPORATE", durum: "DISABLED" }, USER_LIST).filters).toEqual({ tur: "CORPORATE", durum: "DISABLED" });
    expect(parseAdminListParams({ tur: "ROOT", durum: "GONE" }, USER_LIST).filters).toEqual({});
  });

  it("goes to the API under the API's names", () => {
    const query = toApiQuery(parseAdminListParams({ tur: "ADMIN", durum: "ACTIVE", ara: "ada" }, USER_LIST), USER_API_FILTERS);
    expect(query.get("type")).toBe("ADMIN");
    expect(query.get("status")).toBe("ACTIVE");
    expect(query.get("q")).toBe("ada");
    expect(query.get("sort")).toBe("createdAt:desc");
  });
});

describe("the audit log address (V2-34)", () => {
  it("has no sort, and knows the kind of record, who and the days", () => {
    const params = parseAdminListParams({ alan: "branch", yonetici: "cli", bas: "2026-10-01", bit: "2026-10-31", sirala: "at:asc" }, AUDIT_LIST);
    expect(params.sort).toBeNull();
    expect(params.filters).toEqual({ alan: "branch", yonetici: "cli", bas: "2026-10-01", bit: "2026-10-31" });
    expect(parseAdminListParams({ alan: "ping-pong" }, AUDIT_LIST).filters).toEqual({});
    const query = toApiQuery(params, AUDIT_API_FILTERS);
    expect([query.get("actor"), query.get("entity"), query.get("from"), query.get("to")]).toEqual(["cli", "branch", "2026-10-01", "2026-10-31"]);
  });

  it("takes an account id or the terminal as the one who did it, and nothing else", () => {
    expect(validActor("cli")).toBe("cli");
    expect(validActor("6a000000-0000-4000-8000-000000000001")).toBe("6a000000-0000-4000-8000-000000000001");
    expect(validActor("someone")).toBeUndefined();
    expect(validActor("")).toBeUndefined();
  });

  it("has a name in both languages for every kind of record in the filter, and for the actions the log writes", () => {
    for (const messages of [tr, en]) {
      for (const entity of AUDIT_ENTITIES) expect(messages.Admin.audit.entities[entity as keyof typeof messages.Admin.audit.entities], entity).toBeTruthy();
      expect(messages.Admin.audit.actions.user.disable).toBeTruthy();
      expect(messages.Admin.audit.actions.user.enable).toBeTruthy();
      expect(messages.Admin.audit.actions.company["invite-resend"]).toBeTruthy();
    }
  });
});

describe("the sample accounts", () => {
  it("lists the six sample accounts newest first, and narrows by words, type and state", () => {
    const world = "unit-users-list";
    const page = listMockUsers(world, first);
    expect(page.total).toBe(6);
    expect(page.items[0]!.createdAt >= page.items.at(-1)!.createdAt).toBe(true);
    expect(listMockUsers(world, { ...first, q: "KAYA mert" }).items.map((row) => row.id)).toEqual([MERT]);
    expect(listMockUsers(world, { ...first, type: "ADMIN" }).total).toBe(1);
    expect(listMockUsers(world, { ...first, type: "CORPORATE" }).total).toBe(2);
    expect(listMockUsers(world, { ...first, status: "DISABLED" }).items.map((row) => row.id)).toEqual([CAN]);
    expect(listMockUsers(world, { ...first, sort: { key: "email", dir: "asc" } }).items[0]!.email).toBe("ayse.demir@marmaraturizm.example");
  });

  it("says how an account signs in and what is still to come for it", () => {
    const elif = getMockUser("unit-users-one", ELIF)!;
    expect(elif).toMatchObject({ type: "INDIVIDUAL", hasPassword: true, googleLinked: false, reservations: { total: 4, upcoming: 1 }, points: 120 });
    expect(getMockUser("unit-users-one", MERT)!.company?.name).toBe("Ege Lojistik A.Ş.");
    expect(getMockUser("unit-users-one", "yok")).toBeNull();
  });

  it("closing keeps the first date and the bookings, opening brings it back, an administrator is not closed, and each is logged", () => {
    const world = "unit-users-close";
    expect(isMockUserDisabled(world, "elif.yildiz@example.com")).toBe(false);
    expect(disableMockUser(world, ELIF)).toEqual({ status: "ok" });
    const closed = getMockUser(world, ELIF)!;
    expect(closed).toMatchObject({ status: "DISABLED", reservations: { total: 4, upcoming: 1 } });
    expect(isMockUserDisabled(world, "Elif.Yildiz@example.com")).toBe(true);

    disableMockUser(world, ELIF);
    expect(getMockUser(world, ELIF)!.disabledAt).toBe(closed.disabledAt);

    expect(enableMockUser(world, ELIF)).toEqual({ status: "ok" });
    expect(getMockUser(world, ELIF)).toMatchObject({ status: "ACTIVE", disabledAt: null });
    expect(isMockUserDisabled(world, "elif.yildiz@example.com")).toBe(false);

    expect(disableMockUser(world, MOCK_ADMIN_ID)).toEqual({ status: "forbidden" });
    expect(disableMockUser(world, "yok")).toEqual({ status: "not_found" });

    const log = listMockAudit(world, { page: 1, pageSize: 20, actor: null, entity: "user", from: null, to: null });
    expect(log.items.slice(0, 3).map((line) => line.action)).toEqual(["user.enable", "user.disable", "user.disable"]);
    // Another world is untouched.
    expect(isMockUserDisabled("unit-users-other", "elif.yildiz@example.com")).toBe(false);
  });
});

describe("the sample audit log", () => {
  const query = { page: 1, pageSize: 20, actor: null, entity: null, from: null, to: null };

  it("lists the newest first, and narrows by who, kind of record and days", () => {
    const world = "unit-audit";
    const all = listMockAudit(world, query);
    expect(all.total).toBe(11);
    expect(all.items.map((line) => line.at)).toEqual([...all.items.map((line) => line.at)].sort().reverse());
    expect(listMockAudit(world, { ...query, actor: "cli" }).items.map((line) => line.action)).toEqual(["admin.grant"]);
    expect(listMockAudit(world, { ...query, entity: "company" }).total).toBe(2);
    expect(listMockAudit(world, { ...query, actor: MOCK_ADMIN_ID }).total).toBe(10);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
    expect(listMockAudit(world, { ...query, from: today }).total).toBe(0);
    expect(listMockAudit(world, { ...query, to: "2000-01-01" }).total).toBe(0);
  });

  it("pages with a total that does not change", () => {
    const world = "unit-audit-page";
    const one = listMockAudit(world, { ...query, pageSize: 4, page: 1 });
    const three = listMockAudit(world, { ...query, pageSize: 4, page: 3 });
    expect([one.total, three.total]).toEqual([11, 11]);
    expect(one.items).toHaveLength(4);
    expect(three.items).toHaveLength(3);
  });
});
