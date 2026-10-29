"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import {
  modelFormSchema,
  toCreateBody,
  toUpdateBody,
  type AdminModel,
  type ModelFormMessages,
  type ModelFormValues,
  type ModelSaveResult,
  type ModelUsage,
} from "./admin-models";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The vehicle model writes of the panel (V2-29). Each one asks first who is calling: the API checks the role on every call
// anyway (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The input
// is read with the same schema as the form (ADR-26); the action only names the fields that failed.
const messages = codeMessages<ModelFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

// A model change touches the fleet page, the search and the booking pages. They read the API on every request, so this only
// drops what Next may have kept of the rendered pages.
function refreshSite(result: ModelSaveResult): ModelSaveResult {
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

const path = (slug: string) => "/admin/vehicle-models/" + encodeURIComponent(slug);

// The numbers the API gives for a refused retiring; a missing one is none.
const usageFrom = (details: Record<string, number> | undefined): ModelUsage => ({
  reservations: details?.reservations ?? 0,
  holds: details?.holds ?? 0,
});

// An answer of the API, in the words the form works with.
function answer(result: ApiResult<AdminModel>): ModelSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", slug: result.data.slug, updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "SLUG_TAKEN") return { status: "taken" };
      if (result.code === "IN_USE") return { status: "in_use", usage: usageFrom(result.details) };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// A sample-mode answer, in the same words.
type Mock =
  | { status: "ok"; value: AdminModel }
  | { status: "stale" | "not_found" | "taken" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "in_use"; usage: ModelUsage };
function mockAnswer(outcome: Mock): ModelSaveResult {
  if (outcome.status === "ok") return { status: "ok", slug: outcome.value.slug, updatedAt: outcome.value.updatedAt };
  return outcome;
}

const failed = (error: ZodError): ModelSaveResult => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

export async function createModel(input: ModelFormValues): Promise<ModelSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = modelFormSchema(messages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);

  const body = toCreateBody(parsed.data as ModelFormValues);
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/models")).createMockModel(await mockWorld(), body))
      : answer(await apiRequest<AdminModel>("POST", "/admin/vehicle-models", body)),
  );
}

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was
// opened at (the API answers STALE_WRITE if the model moved on since).
export async function updateModel(slug: string, updatedAt: string, input: ModelFormValues, initial: ModelFormValues): Promise<ModelSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const schema = modelFormSchema(messages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return failed(values.error);
  if (!before.success) return { status: "unavailable" };

  const body = toUpdateBody(values.data as ModelFormValues, before.data as ModelFormValues, updatedAt);
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/models")).updateMockModel(await mockWorld(), slug, body))
      : answer(await apiRequest<AdminModel>("PATCH", path(slug), body)),
  );
}

// The API refuses a retiring while a booking to come or a live hold uses a car of the model, and says how many; the answer
// carries those numbers back so the screen can list the reasons.
export async function retireModel(slug: string): Promise<ModelSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/models")).retireMockModel(await mockWorld(), slug))
      : answer(await apiRequest<AdminModel>("POST", path(slug) + "/retire")),
  );
}

export async function restoreModel(slug: string): Promise<ModelSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  return refreshSite(
    isMockMode()
      ? mockAnswer((await import("@/mocks/models")).restoreMockModel(await mockWorld(), slug))
      : answer(await apiRequest<AdminModel>("POST", path(slug) + "/restore")),
  );
}
