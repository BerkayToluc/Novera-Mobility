"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import {
  branchFormSchema,
  toCreateBody,
  toUpdateBody,
  type AdminBranch,
  type BranchFormMessages,
  type BranchFormValues,
  type BranchSaveResult,
  type BranchUsage,
} from "./admin-branches";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The branch writes of the panel (V2-27). Each one asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The input is
// read with the same schema as the form (ADR-26); the action only names the fields that failed.
const messages = codeMessages<BranchFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

// What a branch change touches on the site: the branches page, the search form's list, the booking pages. They read the API
// on every request (nothing of it is cached), so this only drops what Next may have kept of the rendered pages.
function refreshSite(result: BranchSaveResult): BranchSaveResult {
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

const path = (id: string) => "/admin/branches/" + encodeURIComponent(id);

// The numbers the API gives for a refused closing; a missing one is none.
const usageFrom = (details: Record<string, number> | undefined): BranchUsage => ({
  reservations: details?.reservations ?? 0,
  holds: details?.holds ?? 0,
  vehicles: details?.vehicles ?? 0,
});

// An answer of the API, in the words the form works with.
function answer(result: ApiResult<AdminBranch>): BranchSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", id: result.data.id, updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "IN_USE") return { status: "in_use", usage: usageFrom(result.details) };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// A sample-mode answer, in the same words.
type Mock =
  | { status: "ok"; value: AdminBranch }
  | { status: "stale" | "not_found" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "in_use"; usage: BranchUsage };
function mockAnswer(outcome: Mock): BranchSaveResult {
  if (outcome.status === "ok") return { status: "ok", id: outcome.value.id, updatedAt: outcome.value.updatedAt };
  return outcome;
}

const failed = (error: ZodError): BranchSaveResult => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

export async function createBranch(input: BranchFormValues): Promise<BranchSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = branchFormSchema(messages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);

  const body = toCreateBody(parsed.data as BranchFormValues);
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/branches")).createMockBranch(await mockWorld(), body))
      : answer(await apiRequest<AdminBranch>("POST", "/admin/branches", body)),
  );
}

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was
// opened at (the API answers STALE_WRITE if the branch moved on since).
export async function updateBranch(id: string, updatedAt: string, input: BranchFormValues, initial: BranchFormValues): Promise<BranchSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const schema = branchFormSchema(messages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return failed(values.error);
  if (!before.success) return { status: "unavailable" };

  const body = toUpdateBody(values.data as BranchFormValues, before.data as BranchFormValues, updatedAt);
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/branches")).updateMockBranch(await mockWorld(), id, body))
      : answer(await apiRequest<AdminBranch>("PATCH", path(id), body)),
  );
}

// The API refuses a closing while the branch is in use and says how many bookings, holds and cars keep it open; the answer
// carries those numbers back so the screen can list the reasons.
export async function closeBranch(id: string): Promise<BranchSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/branches")).closeMockBranch(await mockWorld(), id))
      : answer(await apiRequest<AdminBranch>("POST", path(id) + "/close")),
  );
}

export async function reopenBranch(id: string): Promise<BranchSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/branches")).reopenMockBranch(await mockWorld(), id))
      : answer(await apiRequest<AdminBranch>("POST", path(id) + "/reopen")),
  );
}
