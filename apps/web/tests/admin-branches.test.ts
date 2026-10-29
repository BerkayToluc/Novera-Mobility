import { describe, expect, it } from "vitest";
import {
  branchFormSchema,
  dayFromApi,
  dayIsValid,
  dayToApi,
  EMPTY_BRANCH_FORM,
  formValuesOf,
  parseCoordinate,
  toCreateBody,
  toUpdateBody,
  type AdminBranch,
  type BranchFormValues,
} from "@/lib/admin-branches";
import { TURKISH_CITIES } from "@/lib/turkish-cities";
import { codeMessages, invalidFields } from "@/lib/validation";
import { closeMockBranch, createMockBranch, getMockBranch, listMockBranches, mockBranchDetails, mockOpenBranches, reopenMockBranch, updateMockBranch } from "@/mocks/branches";

// The sample store is kept per world (lib/mock-world.ts); the tests have one of their own.
const W = "unit-tests";
const schema = branchFormSchema(codeMessages());
const valid = (overrides: Partial<BranchFormValues> = {}): BranchFormValues => ({
  ...EMPTY_BRANCH_FORM,
  name: "Ankara Çankaya",
  city: "Ankara",
  address: "Kızılay Mahallesi, Çankaya",
  latitude: "39,9179",
  longitude: "32.8627",
  phone: "+90 312 555 01 03",
  email: "ankara@novera.example",
  ...overrides,
});
const fieldsOf = (values: BranchFormValues): string[] => {
  const result = schema.safeParse(values);
  return result.success ? [] : invalidFields(result.error).sort();
};

describe("opening hours of a day (V2-27)", () => {
  it("a day is written the way the API stores it, and read back", () => {
    expect(dayToApi({ closed: false, open: "08:30", close: "19:00" })).toBe("08:30-19:00");
    expect(dayToApi({ closed: true, open: "08:30", close: "19:00" })).toBe("closed");
    expect(dayFromApi("09:00-17:00")).toEqual({ closed: false, open: "09:00", close: "17:00" });
    expect(dayFromApi("closed")).toMatchObject({ closed: true });
  });

  it("opens before it closes; a closed day needs no times", () => {
    expect(dayIsValid({ closed: false, open: "08:30", close: "19:00" })).toBe(true);
    expect(dayIsValid({ closed: false, open: "19:00", close: "08:30" })).toBe(false);
    expect(dayIsValid({ closed: false, open: "09:00", close: "09:00" })).toBe(false);
    expect(dayIsValid({ closed: false, open: "", close: "" })).toBe(false);
    expect(dayIsValid({ closed: true, open: "", close: "" })).toBe(true);
  });

  // The sample data writes "until midnight" as 24:00 and the branch cards read it as "open all day".
  it("accepts 24:00 as a closing time, and never as an opening time", () => {
    expect(dayIsValid({ closed: false, open: "00:00", close: "24:00" })).toBe(true);
    expect(dayIsValid({ closed: false, open: "24:00", close: "24:00" })).toBe(false);
  });
});

describe("coordinates (V2-27)", () => {
  it("reads the Turkish decimal comma as a point", () => {
    expect(parseCoordinate("39,9179")).toBe(39.9179);
    expect(parseCoordinate(" 32.8627 ")).toBe(32.8627);
    expect(parseCoordinate("39,9,1")).toBeNull();
    expect(parseCoordinate("kuzey")).toBeNull();
    expect(parseCoordinate("")).toBeNull();
  });
});

describe("the branch form (V2-27)", () => {
  it("accepts a whole branch", () => {
    expect(fieldsOf(valid())).toEqual([]);
  });

  it("asks for every field of an empty form", () => {
    expect(fieldsOf(EMPTY_BRANCH_FORM)).toEqual(["address", "city", "email", "latitude", "longitude", "name", "phone"]);
  });

  it("the city is one of the 81, spelled the way the list spells it", () => {
    expect(TURKISH_CITIES).toHaveLength(81);
    expect(fieldsOf(valid({ city: "Istanbul" }))).toEqual(["city"]);
    expect(fieldsOf(valid({ city: "İstanbul" }))).toEqual([]);
  });

  it("the position is inside Türkiye, and latitude and longitude swapped is caught", () => {
    expect(fieldsOf(valid({ latitude: "32.86", longitude: "39.91" }))).toEqual(["latitude"]);
    expect(fieldsOf(valid({ latitude: "10", longitude: "10" }))).toEqual(["latitude", "longitude"]);
    expect(fieldsOf(valid({ latitude: "36,0", longitude: "26,0" }))).toEqual([]);
  });

  it("a wrong phone, a wrong e-mail and a day that closes before it opens each name their field", () => {
    expect(fieldsOf(valid({ phone: "abc" }))).toEqual(["phone"]);
    expect(fieldsOf(valid({ email: "nope" }))).toEqual(["email"]);
    expect(fieldsOf(valid({ saturday: { closed: false, open: "17:00", close: "09:00" } }))).toEqual(["saturday"]);
  });
});

describe("what is sent to the API (V2-27)", () => {
  it("a new branch: numbers for the position, hours as text, the e-mail as typed minus spaces", () => {
    expect(toCreateBody(valid({ email: " ankara@novera.example ", kind: "AIRPORT" }))).toEqual({
      name: "Ankara Çankaya",
      city: "Ankara",
      address: "Kızılay Mahallesi, Çankaya",
      latitude: 39.9179,
      longitude: 32.8627,
      phone: "+90 312 555 01 03",
      email: "ankara@novera.example",
      kind: "AIRPORT",
      openingHours: { weekdays: "08:30-19:00", saturday: "09:00-17:00", sunday: "closed" },
    });
  });

  const row: AdminBranch = {
    id: "6f1c1b5e-2f3a-4c55-9d0e-0a1b2c3d4e5f",
    name: "Ankara Çankaya",
    city: "Ankara",
    address: "Kızılay Mahallesi, Çankaya",
    latitude: 39.9179,
    longitude: 32.8627,
    phone: "+90 312 555 01 03",
    email: "ankara@novera.example",
    kind: "CITY",
    openingHours: { weekdays: "08:30-19:00", saturday: "09:00-17:00", sunday: "closed" },
    status: "OPEN",
    closedAt: null,
    activeVehicles: 3,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-20T09:00:00.000Z",
  };

  it("the form opens on what is stored, and a change that touches nothing sends only the version", () => {
    const initial = formValuesOf(row);
    expect(toUpdateBody(initial, initial, row.updatedAt)).toEqual({ updatedAt: row.updatedAt });
  });

  it("a change sends only what changed; the days go together", () => {
    const initial = formValuesOf(row);
    expect(toUpdateBody({ ...initial, phone: "+90 312 555 99 99", latitude: "39,92" }, initial, row.updatedAt)).toEqual({
      updatedAt: row.updatedAt,
      phone: "+90 312 555 99 99",
      latitude: 39.92,
    });
    const body = toUpdateBody({ ...initial, saturday: { closed: true, open: "09:00", close: "17:00" } }, initial, row.updatedAt);
    expect(body.openingHours).toEqual({ weekdays: "08:30-19:00", saturday: "closed", sunday: "closed" });
  });

  it("writing a coordinate with a comma instead of a dot is not a change", () => {
    const initial = formValuesOf(row);
    expect(toUpdateBody({ ...initial, latitude: "39,9179" }, initial, row.updatedAt)).toEqual({ updatedAt: row.updatedAt });
  });
});

// The sample mode behaves like the API (mocks/branches.ts), because the panel and the e2e tests are walked on it.
describe("the sample branch store", () => {
  const unique = (word: string) => `${word} ${Math.random().toString(36).slice(2, 8)}`;
  const body = (name: string) => ({
    name,
    city: "Ankara",
    address: "Test mahallesi",
    latitude: 39.9,
    longitude: 32.8,
    phone: "+90 312 555 00 00",
    email: "test@novera.example",
    kind: "CITY" as const,
    openingHours: { weekdays: "08:30-19:00", saturday: "09:00-17:00", sunday: "closed" },
  });

  it("a new branch is on the site at once, and a closed one is not; opening it brings it back", () => {
    const name = unique("Deneme");
    const created = createMockBranch(W, body(name));
    expect(created.status).toBe("ok");
    const id = (created as { value: AdminBranch }).value.id;
    expect(mockOpenBranches(W).some((branch) => branch.id === id)).toBe(true);
    expect(mockBranchDetails(W).find((branch) => branch.id === id)).toMatchObject({ name, kind: "city", openingHours: { sunday: null } });

    expect(closeMockBranch(W, id).status).toBe("ok");
    expect(mockOpenBranches(W).some((branch) => branch.id === id)).toBe(false);
    expect(mockBranchDetails(W).some((branch) => branch.id === id)).toBe(false);
    // The panel still has it.
    expect(getMockBranch(W, id)).toMatchObject({ status: "CLOSED" });

    expect(reopenMockBranch(W, id).status).toBe("ok");
    expect(mockOpenBranches(W).some((branch) => branch.id === id)).toBe(true);
  });

  it("a branch with cars or bookings to come refuses to close, and says how many", () => {
    const outcome = closeMockBranch(W, "istanbul-kadikoy");
    expect(outcome.status).toBe("in_use");
    expect((outcome as { usage: { vehicles: number; reservations: number } }).usage.vehicles).toBeGreaterThan(0);
    expect(getMockBranch(W, "istanbul-kadikoy")?.status).toBe("OPEN");
    // The sample bookings to come start at Kadıköy and Esenboğa.
    expect((closeMockBranch(W, "ankara-esenboga") as { usage: { reservations: number } }).usage.reservations).toBeGreaterThan(0);
  });

  it("an airport of the sample data is an airport, a city office a city office", () => {
    const kinds = Object.fromEntries(mockBranchDetails(W).map((branch) => [branch.id, branch.kind]));
    expect(kinds["istanbul-havalimani"]).toBe("airport");
    expect(kinds["istanbul-kadikoy"]).toBe("city");
  });

  it("an edit made against an old version is refused and changes nothing", () => {
    const created = createMockBranch(W, body(unique("Sürüm"))) as { value: AdminBranch };
    updateMockBranch(W, created.value.id, { updatedAt: created.value.updatedAt, phone: "+90 312 555 11 11" });
    expect(updateMockBranch(W, created.value.id, { updatedAt: created.value.updatedAt, phone: "+90 312 555 22 22" }).status).toBe("stale");
    expect(getMockBranch(W, created.value.id)?.phone).toBe("+90 312 555 11 11");
  });

  it("lists, narrows by city and state, searches without Turkish letters, and pages", () => {
    const base = { page: 1, pageSize: 50, sort: { key: "name", dir: "asc" as const }, q: "", city: null, status: null };
    const all = listMockBranches(W, base);
    expect(all.total).toBeGreaterThanOrEqual(15);
    expect(listMockBranches(W, { ...base, city: "İstanbul" }).items.every((branch) => branch.city === "İstanbul")).toBe(true);
    expect(listMockBranches(W, { ...base, q: "kadikoy" }).items.map((branch) => branch.id)).toContain("istanbul-kadikoy");
    expect(listMockBranches(W, { ...base, status: "CLOSED" }).items.every((branch) => branch.status === "CLOSED")).toBe(true);
    expect(listMockBranches(W, { ...base, pageSize: 4 })).toMatchObject({ page: 1, pageSize: 4, total: all.total });
    expect(listMockBranches(W, { ...base, pageSize: 4 }).items).toHaveLength(4);
  });
});
