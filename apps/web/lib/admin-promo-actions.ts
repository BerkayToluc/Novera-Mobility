"use server";

import { apiRequest, type ApiResult } from "./api-request";
import {
  promoFormSchema,
  toCreateBody,
  toUpdateBody,
  type PromoCode,
  type PromoFormMessages,
  type PromoFormValues,
  type PromoSaveResult,
} from "./admin-promo";
import { isMockMode } from "./mode";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The campaign code writes of the panel (V2-26). Each one asks first who is calling: the API checks the role on every call
// anyway (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well.
// The input is read with the same schema as the form (ADR-26); the action only names the fields that failed.
const messages = codeMessages<PromoFormMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

// An answer of the API, in the words the form works with.
function answer(result: ApiResult<PromoCode | null>): PromoSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", code: result.data?.code ?? "", updatedAt: result.data?.updatedAt ?? "" };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "CODE_TAKEN") return { status: "taken" };
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "IN_USE") return { status: "in_use" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

const path = (code: string) => "/admin/promo-codes/" + encodeURIComponent(code);

// A sample-mode answer, in the same words.
type Mock = { status: "ok"; value: PromoCode | null } | { status: "taken" | "stale" | "in_use" | "not_found" } | { status: "invalid"; fields: Record<string, string> };
function mockAnswer(outcome: Mock): PromoSaveResult {
  if (outcome.status === "ok") return { status: "ok", code: outcome.value?.code ?? "", updatedAt: outcome.value?.updatedAt ?? "" };
  return outcome;
}

export async function createPromoCode(input: PromoFormValues): Promise<PromoSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = promoFormSchema(messages).safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: Object.fromEntries(invalidFields(parsed.error).map((name) => [name, "INVALID_FORMAT"])) };

  const body = toCreateBody(parsed.data);
  if (isMockMode()) return mockAnswer((await import("@/mocks/promo-codes")).createMockPromoCode(body));
  return answer(await apiRequest<PromoCode>("POST", "/admin/promo-codes", body));
}

// `initial` is what the form was opened with, so only what the person changed is sent; `updatedAt` is the version it was
// opened at (the API answers STALE_WRITE if the code moved on since).
export async function updatePromoCode(code: string, updatedAt: string, input: PromoFormValues, initial: PromoFormValues): Promise<PromoSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const schema = promoFormSchema(messages);
  const values = schema.safeParse(input);
  const before = schema.safeParse(initial);
  if (!values.success) return { status: "invalid", fields: Object.fromEntries(invalidFields(values.error).map((name) => [name, "INVALID_FORMAT"])) };
  if (!before.success) return { status: "unavailable" };

  const body = toUpdateBody(values.data, before.data, updatedAt);
  if (isMockMode()) return mockAnswer((await import("@/mocks/promo-codes")).updateMockPromoCode(code, body));
  return answer(await apiRequest<PromoCode>("PATCH", path(code), body));
}

// A code that is on a booking is not deleted: the answer is `in_use`, and the screen offers to switch it off.
export async function deletePromoCode(code: string): Promise<PromoSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  if (isMockMode()) return mockAnswer((await import("@/mocks/promo-codes")).deleteMockPromoCode(code));
  return answer(await apiRequest<null>("DELETE", path(code)));
}

// Switches a code on or off from the list or the page without opening the form.
export async function setPromoCodeActive(code: string, updatedAt: string, active: boolean): Promise<PromoSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  if (isMockMode()) return mockAnswer((await import("@/mocks/promo-codes")).updateMockPromoCode(code, { updatedAt, active }));
  return answer(await apiRequest<PromoCode>("PATCH", path(code), { updatedAt, active }));
}
