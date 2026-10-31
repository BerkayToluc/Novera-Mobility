import type { AdminCompany, AdminCompanyDetail, AdminCompanyPage, AdminCompanyUser, CompanyFormValues, InviteFormValues } from "@/lib/admin-companies";
import { normalizeSearch } from "@/lib/branch-detail";

// The sample companies (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the API's: a name is taken once
// (case and spaces do not matter), an invited person waits until they set a password, an invitation's link lives seven days and
// sending it again makes a new one, and a change carries the version it was made against.
//
// Kept per "world" (lib/mock-world.ts) on `globalThis`, like the branches: a test that adds companies works in a world of its
// own, so the tests that count the sample data never see its changes.
type Person = { id: string; email: string; firstName: string; lastName: string; title: string | null; createdAt: string; pendingUntil: string | null };
type Company = {
  id: string;
  name: string;
  taxOffice: string | null;
  city: string | null;
  phone: string | null;
  salesContact: { name: string; email: string; phone: string } | null;
  createdAt: string;
  updatedAt: string;
  people: Person[];
};

const store = globalThis as typeof globalThis & { __noveraMockCompanies?: Map<string, Company[]> };
const MAX_WORLDS = 60;
const INVITE_DAYS = 7;
const DAY = 86_400_000;

const person = (id: string, email: string, firstName: string, lastName: string, title: string | null, ageDays: number, pendingUntil: string | null = null): Person => ({
  id,
  email,
  firstName,
  lastName,
  title,
  createdAt: new Date(Date.now() - ageDays * DAY).toISOString(),
  pendingUntil,
});

function seed(): Company[] {
  const at = (ageDays: number) => new Date(Date.now() - ageDays * DAY).toISOString();
  return [
    {
      id: "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01",
      name: "Ege Lojistik A.Ş.",
      taxOffice: "Bornova",
      city: "İzmir",
      phone: "+90 232 555 01 00",
      salesContact: { name: "Selin Aksoy", email: "selin.aksoy@novera.example", phone: "+90 212 555 01 99" },
      createdAt: at(120),
      updatedAt: at(120),
      people: [
        person("8a1c2d3e-0000-4000-8000-000000000001", "mert.kaya@egelojistik.example", "Mert", "Kaya", "Filo Müdürü", 120),
        person("8a1c2d3e-0000-4000-8000-000000000002", "deniz.arslan@egelojistik.example", "Deniz", "Arslan", "Satın Alma Uzmanı", 3, new Date(Date.now() + 4 * DAY).toISOString()),
      ],
    },
    {
      id: "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e02",
      name: "Marmara Turizm Ltd. Şti.",
      taxOffice: "Kadıköy",
      city: "İstanbul",
      phone: "+90 216 555 02 00",
      salesContact: null,
      createdAt: at(80),
      updatedAt: at(80),
      people: [person("8a1c2d3e-0000-4000-8000-000000000003", "ayse.demir@marmaraturizm.example", "Ayşe", "Demir", "Operasyon Müdürü", 80)],
    },
    {
      id: "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03",
      name: "Anadolu İnşaat A.Ş.",
      taxOffice: null,
      city: "Ankara",
      phone: null,
      salesContact: null,
      createdAt: at(10),
      updatedAt: at(10),
      people: [],
    },
  ];
}

function rows(world: string): Company[] {
  const worlds = (store.__noveraMockCompanies ??= new Map());
  let found = worlds.get(world);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(world, found);
  }
  return found;
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr");
const isPending = (p: Person) => p.pendingUntil !== null;

const userView = (p: Person): AdminCompanyUser => ({
  id: p.id,
  email: p.email,
  firstName: p.firstName,
  lastName: p.lastName,
  title: p.title,
  status: isPending(p) ? "PENDING" : "ACTIVE",
  invite: p.pendingUntil ? { expiresAt: p.pendingUntil, expired: Date.parse(p.pendingUntil) <= Date.now() } : null,
  createdAt: p.createdAt,
});

const listView = (c: Company): AdminCompany => ({
  id: c.id,
  name: c.name,
  taxOffice: c.taxOffice,
  city: c.city,
  phone: c.phone,
  users: c.people.length,
  pendingUsers: c.people.filter(isPending).length,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const detailView = (c: Company): AdminCompanyDetail => ({
  id: c.id,
  name: c.name,
  taxOffice: c.taxOffice,
  city: c.city,
  phone: c.phone,
  salesContact: c.salesContact,
  users: c.people.map(userView),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

type ListQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string };

export function listMockCompanies(world: string, query: ListQuery): AdminCompanyPage {
  const needle = normalizeSearch(query.q);
  let items = rows(world)
    .map(listView)
    .filter((row) => !needle || normalizeSearch(`${row.name} ${row.taxOffice ?? ""} ${row.city ?? ""}`).includes(needle));
  const sign = query.sort?.dir === "desc" ? -1 : 1;
  const by = query.sort?.key ?? "name";
  const key = (row: AdminCompany): number | string => (by === "users" ? row.users : by === "createdAt" ? row.createdAt : normalizeSearch(row.name));
  items = [...items].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || a.name.localeCompare(b.name, "tr"));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockCompany(world: string, id: string): AdminCompanyDetail | null {
  const found = rows(world).find((row) => row.id === id);
  return found ? detailView(found) : null;
}

export type MockOutcome<T> = { status: "ok"; value: T } | { status: "stale" | "not_found" | "taken" | "settled" } | { status: "invalid"; fields: Record<string, string> };

// A tick later than the version that was read, so two quick edits never share one.
const nextVersion = (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();

const salesOf = (values: CompanyFormValues) =>
  values.salesName.trim() === "" && values.salesEmail.trim() === "" && values.salesPhone.trim() === ""
    ? null
    : { name: values.salesName.trim(), email: values.salesEmail.trim(), phone: values.salesPhone.trim() };

export function createMockCompany(world: string, values: CompanyFormValues): MockOutcome<AdminCompanyDetail> {
  if (rows(world).some((row) => sameName(row.name, values.name))) return { status: "invalid", fields: { name: "NAME_TAKEN" } };
  const now = new Date().toISOString();
  const created: Company = {
    id: "yeni-" + Math.random().toString(36).slice(2, 10),
    name: values.name.trim(),
    taxOffice: values.taxOffice.trim() || null,
    city: values.city.trim() || null,
    phone: values.phone.trim() || null,
    salesContact: salesOf(values),
    createdAt: now,
    updatedAt: now,
    people: [],
  };
  rows(world).push(created);
  return { status: "ok", value: detailView(created) };
}

export function updateMockCompany(world: string, id: string, updatedAt: string, values: CompanyFormValues): MockOutcome<AdminCompanyDetail> {
  const current = rows(world).find((row) => row.id === id);
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== updatedAt) return { status: "stale" };
  if (rows(world).some((row) => row.id !== id && sameName(row.name, values.name))) return { status: "invalid", fields: { name: "NAME_TAKEN" } };
  Object.assign(current, {
    name: values.name.trim(),
    taxOffice: values.taxOffice.trim() || null,
    city: values.city.trim() || null,
    phone: values.phone.trim() || null,
    salesContact: salesOf(values),
    updatedAt: nextVersion(current.updatedAt),
  });
  return { status: "ok", value: detailView(current) };
}

// Some accounts that exist in the sample data besides the ones of the companies: an invitation to one of them is refused.
const SAMPLE_ACCOUNTS = ["musteri@novera.example", "yonetici@novera.example"];

export function inviteMockUser(world: string, companyId: string, values: InviteFormValues): MockOutcome<AdminCompanyUser> {
  const company = rows(world).find((row) => row.id === companyId);
  if (!company) return { status: "not_found" };
  const email = values.email.trim().toLowerCase();
  if (SAMPLE_ACCOUNTS.includes(email) || rows(world).some((row) => row.people.some((p) => p.email === email))) return { status: "taken" };
  const invited = {
    id: "kisi-" + Math.random().toString(36).slice(2, 10),
    email,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    title: values.title.trim() || null,
    createdAt: new Date().toISOString(),
    pendingUntil: new Date(Date.now() + INVITE_DAYS * DAY).toISOString(),
  };
  company.people.push(invited);
  return { status: "ok", value: userView(invited) };
}

export function resendMockInvite(world: string, companyId: string, userId: string): MockOutcome<AdminCompanyUser> {
  const company = rows(world).find((row) => row.id === companyId);
  const found = company?.people.find((p) => p.id === userId);
  if (!found) return { status: "not_found" };
  if (!isPending(found)) return { status: "settled" };
  found.pendingUntil = new Date(Date.now() + INVITE_DAYS * DAY).toISOString();
  return { status: "ok", value: userView(found) };
}
