import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The company screens (V2-33, docs/ADMIN.md §3.3): what a company and its people look like to the administrator, the list's
// address, and the forms that write them. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminCompany = Schemas["AdminCompanyListItem"];
export type AdminCompanyDetail = Schemas["AdminCompanyDetail"];
export type AdminCompanyPage = Schemas["AdminCompanyPage"];
export type AdminCompanyUser = Schemas["AdminCompanyUser"];

// The list: what it can be sorted by (the API's names) and the default order. There is no filter, only the search.
export const COMPANY_LIST = {
  sortable: ["name", "users", "createdAt"],
  defaultSort: { key: "name", dir: "asc" },
  filters: {},
} satisfies AdminListConfig<never>;

// ---------- The company form ----------
export type CompanyFormValues = {
  name: string;
  taxOffice: string;
  city: string;
  phone: string;
  // The sales contact is three fields that go together: all filled, or all empty.
  salesName: string;
  salesEmail: string;
  salesPhone: string;
};

export const EMPTY_COMPANY_FORM: CompanyFormValues = { name: "", taxOffice: "", city: "", phone: "", salesName: "", salesEmail: "", salesPhone: "" };

export type CompanyFormMessages = {
  name: string;
  taxOffice: string;
  city: string;
  phone: string;
  salesName: string;
  salesEmail: string;
  salesPhone: string;
};

// The same rule as the API's phone check (`phone` in the API's admin-fields.ts): digits and the usual separators, 7 digits at least.
const phoneLike = (value: string): boolean => /^[0-9+()\-.\s]+$/.test(value) && value.replace(/\D/g, "").length >= 7;
const optionalPhone = (value: string): boolean => value.trim() === "" || phoneLike(value.trim());

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26).
export const companyFormSchema = (m: CompanyFormMessages) =>
  z
    .object({
      name: z.string().trim().min(2, m.name).max(120, m.name),
      taxOffice: z.string().trim().max(80, m.taxOffice),
      city: z.string().trim().max(60, m.city),
      phone: z.string().max(30, m.phone).refine(optionalPhone, m.phone),
      salesName: z.string().trim().max(80, m.salesName),
      salesEmail: z.string().trim().max(120, m.salesEmail),
      salesPhone: z.string().max(30, m.salesPhone).refine(optionalPhone, m.salesPhone),
    })
    .superRefine((value, context) => {
      const parts = [value.salesName.trim(), value.salesEmail.trim(), value.salesPhone.trim()];
      if (parts.every((part) => part === "")) return;
      // Some filled and some empty: the empty ones are asked for. A filled e-mail address has to be one.
      if (parts[0] === "") context.addIssue({ code: "custom", path: ["salesName"], message: m.salesName });
      if (parts[1] === "" || !z.email().safeParse(parts[1]).success) context.addIssue({ code: "custom", path: ["salesEmail"], message: m.salesEmail });
      if (parts[2] === "") context.addIssue({ code: "custom", path: ["salesPhone"], message: m.salesPhone });
    });

type CreateBody = Schemas["AdminCompanyCreate"];
type UpdateBody = Schemas["AdminCompanyUpdate"];

const salesOf = (values: CompanyFormValues) =>
  values.salesName.trim() === "" && values.salesEmail.trim() === "" && values.salesPhone.trim() === ""
    ? null
    : { name: values.salesName.trim(), email: values.salesEmail.trim(), phone: values.salesPhone.trim() };

export function toCreateBody(values: CompanyFormValues): CreateBody {
  const body: CreateBody = { name: values.name.trim() };
  if (values.taxOffice.trim()) body.taxOffice = values.taxOffice.trim();
  if (values.city.trim()) body.city = values.city.trim();
  if (values.phone.trim()) body.phone = values.phone.trim();
  const sales = salesOf(values);
  if (sales) body.salesContact = sales;
  return body;
}

// Only what changed, and the version it was made against. An optional field emptied is sent as nothing (`null`), which clears it.
export function toUpdateBody(values: CompanyFormValues, initial: CompanyFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.name.trim() !== initial.name.trim()) body.name = values.name.trim();
  if (values.taxOffice.trim() !== initial.taxOffice.trim()) body.taxOffice = values.taxOffice.trim() || null;
  if (values.city.trim() !== initial.city.trim()) body.city = values.city.trim() || null;
  if (values.phone.trim() !== initial.phone.trim()) body.phone = values.phone.trim() || null;
  if (JSON.stringify(salesOf(values)) !== JSON.stringify(salesOf(initial))) body.salesContact = salesOf(values);
  return body;
}

export function formValuesOf(row: AdminCompanyDetail): CompanyFormValues {
  return {
    name: row.name,
    taxOffice: row.taxOffice ?? "",
    city: row.city ?? "",
    phone: row.phone ?? "",
    salesName: row.salesContact?.name ?? "",
    salesEmail: row.salesContact?.email ?? "",
    salesPhone: row.salesContact?.phone ?? "",
  };
}

// ---------- The invitation form ----------
export type InviteFormValues = { email: string; firstName: string; lastName: string; title: string; locale: "tr" | "en" };

export const EMPTY_INVITE_FORM: InviteFormValues = { email: "", firstName: "", lastName: "", title: "", locale: "tr" };

export type InviteFormMessages = { email: string; firstName: string; lastName: string; title: string };

export const inviteFormSchema = (m: InviteFormMessages) =>
  z.object({
    email: z.email(m.email).max(120, m.email),
    firstName: z.string().trim().min(1, m.firstName).max(60, m.firstName),
    lastName: z.string().trim().min(1, m.lastName).max(60, m.lastName),
    title: z.string().trim().max(80, m.title),
    locale: z.enum(["tr", "en"]),
  });

export function toInviteBody(values: InviteFormValues): Schemas["AdminCompanyInvite"] {
  const body: Schemas["AdminCompanyInvite"] = { email: values.email.trim(), firstName: values.firstName.trim(), lastName: values.lastName.trim(), locale: values.locale };
  if (values.title.trim()) body.title = values.title.trim();
  return body;
}

// ---------- What a save answers ----------
// `fields` maps a form field to the API's code for it.
export type CompanySaveResult =
  | { status: "ok"; id: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "stale" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

// An invitation (or sending it again): `taken` is an e-mail address that already has an account; `settled` is a person who has
// set a password already, so there is nothing to send again.
export type InviteResult =
  | { status: "ok" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "taken" }
  | { status: "settled" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
