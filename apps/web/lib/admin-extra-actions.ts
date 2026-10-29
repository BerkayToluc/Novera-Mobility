"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { extraFormSchema, toUpdateBody, type AdminExtra, type ExtraFormMessages, type ExtraFormValues, type ExtraSaveResult } from "./admin-extras";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The extra service write of the panel (V2-30). It asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The input is read
// with the same schema as the form (ADR-26); the action only names the fields that failed.
const messages = codeMessages<ExtraFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

function answer(result: ApiResult<AdminExtra>): ExtraSaveResult {
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
      return result.code === "STALE_WRITE" ? { status: "stale" } : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

const failed = (error: ZodError): ExtraSaveResult => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was opened
// at. The new price is for the next quote and booking: a booking that was made keeps its own.
export async function updateExtra(slug: string, updatedAt: string, input: ExtraFormValues, initial: ExtraFormValues): Promise<ExtraSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const schema = extraFormSchema(messages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return failed(values.error);
  if (!before.success) return { status: "unavailable" };

  const body = toUpdateBody(values.data as ExtraFormValues, before.data as ExtraFormValues, updatedAt);
  const result: ExtraSaveResult = isMockMode()
    ? await (async (): Promise<ExtraSaveResult> => {
        const outcome = (await import("@/mocks/extras")).updateMockExtra(await mockWorld(), slug, body);
        return outcome.status === "ok" ? { status: "ok", slug: outcome.value.slug, updatedAt: outcome.value.updatedAt } : outcome;
      })()
    : answer(await apiRequest<AdminExtra>("PATCH", "/admin/extras/" + encodeURIComponent(slug), body));
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
