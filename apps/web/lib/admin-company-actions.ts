"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import {
  companyFormSchema,
  inviteFormSchema,
  toCreateBody,
  toInviteBody,
  toUpdateBody,
  type AdminCompanyDetail,
  type AdminCompanyUser,
  type CompanyFormMessages,
  type CompanyFormValues,
  type CompanySaveResult,
  type InviteFormMessages,
  type InviteFormValues,
  type InviteResult,
} from "./admin-companies";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The company writes of the panel (V2-33). Each one asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The input is
// read with the same schema as the form (ADR-26); the action only names the fields that failed.
const companyMessages = codeMessages<CompanyFormMessages>();
const inviteMessages = codeMessages<InviteFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

const path = (id: string) => "/admin/companies/" + encodeURIComponent(id);

const failed = (error: ZodError): { status: "invalid"; fields: Record<string, string> } => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

// The API names the sales contact as one field; the form has three of them.
function formFields(fields: Record<string, string>): Record<string, string> {
  const { salesContact, ...rest } = fields;
  return salesContact ? { ...rest, salesName: salesContact, salesEmail: salesContact, salesPhone: salesContact } : rest;
}

function companyAnswer(result: ApiResult<AdminCompanyDetail>): CompanySaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", id: result.data.id, updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: formFields(result.fieldErrors) };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "NAME_TAKEN") return { status: "invalid", fields: { name: "NAME_TAKEN" } };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

function inviteAnswer(result: ApiResult<AdminCompanyUser>): InviteResult {
  switch (result.status) {
    case "ok":
      return { status: "ok" };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "EMAIL_TAKEN") return { status: "taken" };
      if (result.code === "INVALID_TRANSITION") return { status: "settled" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// A sample-mode answer, in the same words.
type Mock<T> = { status: "ok"; value: T } | { status: "stale" | "not_found" | "taken" | "settled" } | { status: "invalid"; fields: Record<string, string> };
function mockCompany(outcome: Mock<AdminCompanyDetail>): CompanySaveResult {
  switch (outcome.status) {
    case "ok":
      return { status: "ok", id: outcome.value.id, updatedAt: outcome.value.updatedAt };
    case "invalid":
      return outcome;
    case "stale":
    case "not_found":
      return { status: outcome.status };
    default:
      return { status: "unavailable" };
  }
}

function mockInvite(outcome: Mock<AdminCompanyUser>): InviteResult {
  switch (outcome.status) {
    case "ok":
      return { status: "ok" };
    case "invalid":
      return outcome;
    case "taken":
    case "settled":
    case "not_found":
      return { status: outcome.status };
    default:
      return { status: "unavailable" };
  }
}

export async function createCompany(input: CompanyFormValues): Promise<CompanySaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = companyFormSchema(companyMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);

  const result = isMockMode()
    ? mockCompany((await import("@/mocks/admin-companies")).createMockCompany(await mockWorld(), parsed.data as CompanyFormValues))
    : companyAnswer(await apiRequest<AdminCompanyDetail>("POST", "/admin/companies", toCreateBody(parsed.data as CompanyFormValues)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was
// opened at (the API answers STALE_WRITE if the company moved on since).
export async function updateCompany(id: string, updatedAt: string, input: CompanyFormValues, initial: CompanyFormValues): Promise<CompanySaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const schema = companyFormSchema(companyMessages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return failed(values.error);
  if (!before.success) return { status: "unavailable" };

  const result = isMockMode()
    ? mockCompany((await import("@/mocks/admin-companies")).updateMockCompany(await mockWorld(), id, updatedAt, values.data as CompanyFormValues))
    : companyAnswer(await apiRequest<AdminCompanyDetail>("PATCH", path(id), toUpdateBody(values.data as CompanyFormValues, before.data as CompanyFormValues, updatedAt)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

export async function inviteUser(companyId: string, input: InviteFormValues): Promise<InviteResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = inviteFormSchema(inviteMessages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);

  const result = isMockMode()
    ? mockInvite((await import("@/mocks/admin-companies")).inviteMockUser(await mockWorld(), companyId, parsed.data as InviteFormValues))
    : inviteAnswer(await apiRequest<AdminCompanyUser>("POST", path(companyId) + "/users", toInviteBody(parsed.data as InviteFormValues)));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

export async function resendInvite(companyId: string, userId: string): Promise<InviteResult> {
  if (!(await isAdministrator())) return { status: "not_found" };

  const result = isMockMode()
    ? mockInvite((await import("@/mocks/admin-companies")).resendMockInvite(await mockWorld(), companyId, userId))
    : inviteAnswer(await apiRequest<AdminCompanyUser>("POST", path(companyId) + "/users/" + encodeURIComponent(userId) + "/resend"));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
