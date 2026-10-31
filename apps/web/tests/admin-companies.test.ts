import { describe, expect, it } from "vitest";
import {
  companyFormSchema,
  COMPANY_LIST,
  EMPTY_COMPANY_FORM,
  EMPTY_INVITE_FORM,
  formValuesOf,
  inviteFormSchema,
  toCreateBody,
  toInviteBody,
  toUpdateBody,
  type CompanyFormValues,
} from "@/lib/admin-companies";
import { parseAdminListParams } from "@/lib/admin-query";
import { codeMessages, invalidFields } from "@/lib/validation";
import { createMockCompany, getMockCompany, inviteMockUser, listMockCompanies, resendMockInvite, updateMockCompany } from "@/mocks/admin-companies";

// The sample store is kept per world (lib/mock-world.ts); each test group has one of its own.
const schema = companyFormSchema(codeMessages());
const valid = (overrides: Partial<CompanyFormValues> = {}): CompanyFormValues => ({ ...EMPTY_COMPANY_FORM, name: "Doğu Taşımacılık A.Ş.", ...overrides });
const fieldsOf = (values: CompanyFormValues): string[] => {
  const result = schema.safeParse(values);
  return result.success ? [] : invalidFields(result.error).sort();
};

describe("the company form (V2-33)", () => {
  it("only the name is required; the rest may be empty", () => {
    expect(fieldsOf(valid())).toEqual([]);
    expect(fieldsOf(EMPTY_COMPANY_FORM)).toEqual(["name"]);
    expect(fieldsOf(valid({ name: "A" }))).toEqual(["name"]);
    expect(fieldsOf(valid({ name: "x".repeat(121) }))).toEqual(["name"]);
  });

  it("the phone number is a number, and the other texts have their limits", () => {
    expect(fieldsOf(valid({ phone: "+90 232 555 01 00" }))).toEqual([]);
    expect(fieldsOf(valid({ phone: "abc" }))).toEqual(["phone"]);
    expect(fieldsOf(valid({ phone: "123" }))).toEqual(["phone"]);
    expect(fieldsOf(valid({ taxOffice: "x".repeat(81), city: "y".repeat(61) }))).toEqual(["city", "taxOffice"]);
  });

  it("the sales contact is all three fields or none", () => {
    const sales = { salesName: "Selin Aksoy", salesEmail: "selin@novera.example", salesPhone: "+90 212 555 01 99" };
    expect(fieldsOf(valid(sales))).toEqual([]);
    expect(fieldsOf(valid({ salesName: "Selin Aksoy" }))).toEqual(["salesEmail", "salesPhone"]);
    expect(fieldsOf(valid({ ...sales, salesEmail: "degil" }))).toEqual(["salesEmail"]);
    expect(fieldsOf(valid({ ...sales, salesName: "  " }))).toEqual(["salesName"]);
  });

  it("a new company sends what was filled and leaves out the rest", () => {
    expect(toCreateBody(valid())).toEqual({ name: "Doğu Taşımacılık A.Ş." });
    expect(toCreateBody(valid({ name: "  Doğu  ", city: " Ankara ", salesName: "S", salesEmail: "s@x.co", salesPhone: "+90 212 555 01 99" }))).toEqual({
      name: "Doğu",
      city: "Ankara",
      salesContact: { name: "S", email: "s@x.co", phone: "+90 212 555 01 99" },
    });
  });

  it("a change sends only what changed and the version; an emptied field is sent as nothing", () => {
    const initial = valid({ taxOffice: "Bornova", city: "İzmir", salesName: "S", salesEmail: "s@x.co", salesPhone: "+90 212 555 01 99" });
    expect(toUpdateBody(initial, initial, "v1")).toEqual({ updatedAt: "v1" });
    expect(toUpdateBody({ ...initial, city: "" }, initial, "v1")).toEqual({ updatedAt: "v1", city: null });
    expect(toUpdateBody({ ...initial, name: "Yeni Ad" }, initial, "v1")).toEqual({ updatedAt: "v1", name: "Yeni Ad" });
    expect(toUpdateBody({ ...initial, salesName: "", salesEmail: "", salesPhone: "" }, initial, "v1")).toEqual({ updatedAt: "v1", salesContact: null });
    expect(toUpdateBody({ ...initial, salesPhone: "+90 212 555 01 00" }, initial, "v1").salesContact).toEqual({ name: "S", email: "s@x.co", phone: "+90 212 555 01 00" });
  });

  it("the form opens with what is stored", () => {
    const company = getMockCompany("unit-read", "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01")!;
    expect(formValuesOf(company)).toMatchObject({ name: "Ege Lojistik A.Ş.", taxOffice: "Bornova", city: "İzmir", salesName: "Selin Aksoy" });
    expect(formValuesOf(getMockCompany("unit-read", "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03")!)).toMatchObject({ taxOffice: "", phone: "", salesName: "" });
  });
});

describe("the invitation form (V2-33)", () => {
  const check = inviteFormSchema(codeMessages());
  const fields = (values: object) => {
    const result = check.safeParse(values);
    return result.success ? [] : invalidFields(result.error).sort();
  };

  it("asks for an e-mail address and a name, and takes the title and the language as they are", () => {
    expect(fields(EMPTY_INVITE_FORM)).toEqual(["email", "firstName", "lastName"]);
    expect(fields({ ...EMPTY_INVITE_FORM, email: "mert@egelojistik.example", firstName: "Mert", lastName: "Kaya" })).toEqual([]);
    expect(fields({ ...EMPTY_INVITE_FORM, email: "degil", firstName: "M", lastName: "K" })).toEqual(["email"]);
    expect(fields({ ...EMPTY_INVITE_FORM, email: "a@b.co", firstName: "M", lastName: "K", locale: "fr" })).toEqual(["locale"]);
  });

  it("the body leaves an empty title out", () => {
    expect(toInviteBody({ ...EMPTY_INVITE_FORM, email: " a@b.co ", firstName: " M ", lastName: "K" })).toEqual({ email: "a@b.co", firstName: "M", lastName: "K", locale: "tr" });
    expect(toInviteBody({ ...EMPTY_INVITE_FORM, email: "a@b.co", firstName: "M", lastName: "K", title: "Müdür", locale: "en" }).title).toBe("Müdür");
  });
});

describe("the list address", () => {
  it("sorts by name, people or date, and ignores anything else", () => {
    expect(parseAdminListParams({ sirala: "users:desc" }, COMPANY_LIST).sort).toEqual({ key: "users", dir: "desc" });
    expect(parseAdminListParams({ sirala: "salesContact:asc" }, COMPANY_LIST).sort).toEqual({ key: "name", dir: "asc" });
    expect(parseAdminListParams({ ara: "ege" }, COMPANY_LIST).q).toBe("ege");
  });
});

describe("the sample companies", () => {
  const first = { page: 1, pageSize: 20, sort: null, q: "" };

  it("lists the three sample companies by name, with the people and the waiting ones counted", () => {
    const page = listMockCompanies("unit-list", first);
    expect(page.items.map((row) => row.name)).toEqual(["Anadolu İnşaat A.Ş.", "Ege Lojistik A.Ş.", "Marmara Turizm Ltd. Şti."]);
    expect(page.items.find((row) => row.name.startsWith("Ege"))).toMatchObject({ users: 2, pendingUsers: 1 });
    expect(listMockCompanies("unit-list", { ...first, sort: { key: "users", dir: "desc" } }).items[0]!.name).toBe("Ege Lojistik A.Ş.");
    expect(listMockCompanies("unit-list", { ...first, q: "MARMARA" }).total).toBe(1);
  });

  it("a name is taken once, whatever its case and spaces", () => {
    const world = "unit-name";
    expect(createMockCompany(world, valid({ name: "  ege LOJİSTİK a.ş. " }))).toEqual({ status: "invalid", fields: { name: "NAME_TAKEN" } });
    const made = createMockCompany(world, valid());
    expect(made.status).toBe("ok");
    expect(listMockCompanies(world, first).total).toBe(4);
    // Another world is untouched.
    expect(listMockCompanies("unit-name-other", first).total).toBe(3);
  });

  it("a change made against an old version is stale, and a new one moves the version on", () => {
    const world = "unit-update";
    const company = getMockCompany(world, "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e02")!;
    expect(updateMockCompany(world, company.id, "2000-01-01T00:00:00.000Z", valid()).status).toBe("stale");
    const saved = updateMockCompany(world, company.id, company.updatedAt, valid({ name: "Marmara Turizm" }));
    expect(saved.status).toBe("ok");
    if (saved.status === "ok") expect(saved.value.updatedAt > company.updatedAt).toBe(true);
    expect(updateMockCompany(world, "yok", company.updatedAt, valid()).status).toBe("not_found");
  });

  it("an invited person waits for seven days; sending again makes a new link, and a settled person has nothing to send", () => {
    const world = "unit-invite";
    const id = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
    const invited = inviteMockUser(world, id, { ...EMPTY_INVITE_FORM, email: "Yeni@Anadolu.example", firstName: "Yeni", lastName: "Kişi" });
    expect(invited.status).toBe("ok");
    if (invited.status !== "ok") return;
    expect(invited.value).toMatchObject({ email: "yeni@anadolu.example", status: "PENDING" });
    const days = (Date.parse(invited.value.invite!.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
    expect(getMockCompany(world, id)!.users).toHaveLength(1);

    expect(inviteMockUser(world, id, { ...EMPTY_INVITE_FORM, email: "yeni@anadolu.example", firstName: "A", lastName: "B" }).status).toBe("taken");
    expect(inviteMockUser(world, id, { ...EMPTY_INVITE_FORM, email: "mert.kaya@egelojistik.example", firstName: "A", lastName: "B" }).status).toBe("taken");
    expect(resendMockInvite(world, id, invited.value.id).status).toBe("ok");
    expect(resendMockInvite(world, "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01", "8a1c2d3e-0000-4000-8000-000000000001").status).toBe("settled");
    expect(resendMockInvite(world, id, "yok").status).toBe("not_found");
  });
});
