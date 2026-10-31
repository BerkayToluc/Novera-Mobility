import type { AdminAuditEntry, AdminAuditPage } from "@/lib/admin-audit";
import type { AdminUser, AdminUserDetail, AdminUserPage, AdminUserType } from "@/lib/admin-users";
import { normalizeSearch } from "@/lib/branch-detail";

// The sample accounts and the sample audit log (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's:
// an administrator's account is not closed, closing one that is closed keeps the first date, and what is closed or opened is
// written to the log. A closed account cannot sign in (the sample sign-in asks `isMockUserDisabled`).
//
// Kept per "world" (lib/mock-world.ts) on `globalThis`, like the branches: a test that closes an account works in a world of its
// own, so the tests that count the sample data never see its changes.
type Person = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  type: AdminUserType;
  companyName: string | null;
  title: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  reservations: { total: number; upcoming: number };
  points: number;
  disabledAt: string | null;
  createdAt: string;
};
type World = { people: Person[]; log: AdminAuditEntry[] };

const store = globalThis as typeof globalThis & { __noveraMockUsers?: Map<string, World> };
const MAX_WORLDS = 60;
const DAY = 86_400_000;
const HOUR = 3_600_000;

export const MOCK_ADMIN_ID = "6a000000-0000-4000-8000-000000000001";
export const MOCK_CLI = "cli";

const id = (n: number) => `6a000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function seed(): World {
  const at = (ageMs: number) => new Date(Date.now() - ageMs).toISOString();
  const person = (n: number, p: Partial<Person> & Pick<Person, "email" | "firstName" | "lastName" | "type">): Person => ({
    id: id(n),
    companyName: null,
    title: null,
    hasPassword: true,
    googleLinked: false,
    reservations: { total: 0, upcoming: 0 },
    points: 0,
    disabledAt: null,
    createdAt: at(30 * DAY),
    ...p,
  });
  const people: Person[] = [
    person(1, { email: "yonetici@novera.example", firstName: "Deniz", lastName: "Yönetici", type: "ADMIN", createdAt: at(200 * DAY) }),
    person(2, { email: "elif.yildiz@example.com", firstName: "Elif", lastName: "Yıldız", type: "INDIVIDUAL", reservations: { total: 4, upcoming: 1 }, points: 120, createdAt: at(90 * DAY) }),
    person(3, { email: "ece.aydin@example.com", firstName: "Ece", lastName: "Aydın", type: "INDIVIDUAL", hasPassword: false, googleLinked: true, reservations: { total: 1, upcoming: 0 }, points: 15, createdAt: at(40 * DAY) }),
    person(4, { email: "filo@egelojistik.example", firstName: "Mert", lastName: "Kaya", type: "CORPORATE", companyName: "Ege Lojistik A.Ş.", title: "Filo Müdürü", reservations: { total: 9, upcoming: 2 }, points: 0, createdAt: at(120 * DAY) }),
    person(5, { email: "ayse.demir@marmaraturizm.example", firstName: "Ayşe", lastName: "Demir", type: "CORPORATE", companyName: "Marmara Turizm Ltd. Şti.", title: "Operasyon Müdürü", reservations: { total: 3, upcoming: 0 }, createdAt: at(80 * DAY) }),
    person(6, { email: "can.ozturk@example.com", firstName: "Can", lastName: "Öztürk", type: "INDIVIDUAL", reservations: { total: 2, upcoming: 1 }, points: 5, disabledAt: at(2 * DAY), createdAt: at(60 * DAY) }),
  ];
  const line = (n: number, ageMs: number, actor: string, action: string, entity: string, entityId: string | null, fields: string[]): AdminAuditEntry => ({
    id: `7b000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    at: at(ageMs),
    actor: actor === MOCK_CLI ? { id: MOCK_CLI, name: null, email: null } : { id: MOCK_ADMIN_ID, name: "Deniz Yönetici", email: "yonetici@novera.example" },
    action,
    entity,
    entityId,
    companyId: null,
    fields,
  });
  const admin = MOCK_ADMIN_ID;
  const log: AdminAuditEntry[] = [
    line(1, 2 * DAY, admin, "user.disable", "user", id(6), []),
    line(2, 2 * DAY + 3 * HOUR, admin, "reservation.cancel", "reservation", "NVR-2026-00042", ["reason"]),
    line(3, 3 * DAY, admin, "company.invite", "company", "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01", ["email", "firstName", "lastName", "title"]),
    line(4, 3 * DAY + 2 * HOUR, admin, "company.create", "company", "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e02", ["name", "city"]),
    line(5, 5 * DAY, admin, "branch.update", "branch", "izmir-adnan-menderes", ["updatedAt", "phone"]),
    line(6, 6 * DAY, admin, "promo-code.create", "promo-code", "YAZ25", ["code", "percent", "validTo"]),
    line(7, 8 * DAY, admin, "quote.update", "quote", "TKL-2026-00007", ["updatedAt", "status"]),
    line(8, 9 * DAY, admin, "vehicle.create", "vehicle", "6c000000-0000-4000-8000-000000000001", ["plate", "year", "model", "branchId"]),
    line(9, 12 * DAY, admin, "branch.close", "branch", "bodrum-merkez", ["updatedAt"]),
    line(10, 14 * DAY, admin, "contact-message.handle", "contact-message", "m5", ["handled"]),
    line(11, 20 * DAY, MOCK_CLI, "admin.grant", "user", MOCK_ADMIN_ID, ["role", "password"]),
  ];
  return { people, log };
}

function world(name: string): World {
  const worlds = (store.__noveraMockUsers ??= new Map());
  let found = worlds.get(name);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(name, found);
  }
  return found;
}

const listView = (p: Person): AdminUser => ({
  id: p.id,
  email: p.email,
  firstName: p.firstName,
  lastName: p.lastName,
  type: p.type,
  status: p.disabledAt ? "DISABLED" : "ACTIVE",
  companyName: p.companyName,
  disabledAt: p.disabledAt,
  createdAt: p.createdAt,
});

const detailView = (p: Person): AdminUserDetail => ({
  ...listView(p),
  title: p.title,
  locale: "TR",
  hasPassword: p.hasPassword,
  googleLinked: p.googleLinked,
  company: p.companyName ? { id: "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01", name: p.companyName } : null,
  reservations: p.reservations,
  points: p.points,
});

type UserQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string; type: string | null; status: string | null };

export function listMockUsers(name: string, query: UserQuery): AdminUserPage {
  const words = normalizeSearch(query.q).split(/\s+/).filter(Boolean);
  let items = world(name)
    .people.map(listView)
    .filter((row) => {
      const haystack = normalizeSearch(`${row.email} ${row.firstName} ${row.lastName}`);
      return words.every((word) => haystack.includes(word)) && (!query.type || row.type === query.type) && (!query.status || row.status === query.status);
    });
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  const by = query.sort?.key ?? "createdAt";
  const key = (row: AdminUser): string => (by === "email" ? row.email : by === "lastName" ? normalizeSearch(row.lastName) : row.createdAt);
  items = [...items].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || a.id.localeCompare(b.id));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockUser(name: string, userId: string): AdminUserDetail | null {
  const found = world(name).people.find((p) => p.id === userId);
  return found ? detailView(found) : null;
}

// Whether the sample sign-in has to turn this address away: it belongs to an account that is closed.
export function isMockUserDisabled(name: string, email: string): boolean {
  return world(name).people.some((p) => p.email === email.trim().toLowerCase() && p.disabledAt !== null);
}

export type MockOutcome = { status: "ok" } | { status: "not_found" | "forbidden" };

function change(name: string, userId: string, action: "user.disable" | "user.enable"): MockOutcome {
  const w = world(name);
  const found = w.people.find((p) => p.id === userId);
  if (!found) return { status: "not_found" };
  if (found.type === "ADMIN") return { status: "forbidden" };
  const closing = action === "user.disable";
  // Closing a closed account (or opening an open one) changes nothing, and keeps the first date.
  if (closing ? found.disabledAt === null : found.disabledAt !== null) found.disabledAt = closing ? new Date().toISOString() : null;
  w.log.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: { id: MOCK_ADMIN_ID, name: "Deniz Yönetici", email: "yonetici@novera.example" },
    action,
    entity: "user",
    entityId: userId,
    companyId: null,
    fields: [],
  });
  return { status: "ok" };
}

export const disableMockUser = (name: string, userId: string): MockOutcome => change(name, userId, "user.disable");
export const enableMockUser = (name: string, userId: string): MockOutcome => change(name, userId, "user.enable");

// The Istanbul calendar day of an instant, "2026-10-31": the days the log is narrowed to are those.
const istanbulDay = (iso: string): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

type AuditQuery = { page: number; pageSize: number; actor: string | null; entity: string | null; from: string | null; to: string | null };

export function listMockAudit(name: string, query: AuditQuery): AdminAuditPage {
  // The newest line is put first when it is written, and the sort is stable, so lines of one moment keep the order they were written in.
  const items = world(name)
    .log.filter((row) => (!query.actor || row.actor.id === query.actor) && (!query.entity || row.entity === query.entity) && (!query.from || istanbulDay(row.at) >= query.from) && (!query.to || istanbulDay(row.at) <= query.to))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

// The administrators, for the log's "who" filter.
export const mockAdministrators = (name: string): Array<{ id: string; label: string }> =>
  world(name)
    .people.filter((p) => p.type === "ADMIN")
    .map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}` }));
