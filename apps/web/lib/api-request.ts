import "server-only";
import { cookies, headers } from "next/headers";

// What came back from a call to the API, for the calls that need more outcomes than api-post.ts
// offers: a signed-in read (401), a booking that was taken (409), a missing record (404), an empty
// answer (204 and 202). `code` is the API's machine code (`VEHICLE_UNAVAILABLE`, `RESET_TOKEN_INVALID`).
export type ApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "invalid"; code?: string; fieldErrors: Record<string, string> }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "conflict"; code?: string }
  | { status: "rate_limited" }
  | { status: "unavailable" };

// The name of the session cookie the API sets (openapi `cookieAuth`).
const SESSION_COOKIE = "novera_session";

type ErrorBody = { code?: string; fieldErrors?: Record<string, string> };

// A call from the server to the API on behalf of the visitor: their address (`X-Forwarded-For`, so
// the per-address limits see them and not this server) and their session cookie travel along.
// Without API_URL the service is simply not there.
export async function apiRequest<T = null>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const base = process.env.API_URL;
  if (!base) return { status: "unavailable" };

  const forwarded = (await headers()).get("x-forwarded-for");
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(forwarded ? { "X-Forwarded-For": forwarded } : {}),
        ...(session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (response.ok) {
      // 202 and 204 carry no body; reading one would throw.
      if (response.status === 202 || response.status === 204) return { status: "ok", data: null as T };
      return { status: "ok", data: (await response.json()) as T };
    }
    if (response.status === 401) return { status: "unauthorized" };
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 429) return { status: "rate_limited" };
    const error = (await response.json().catch(() => null)) as ErrorBody | null;
    if (response.status === 409) return { status: "conflict", code: error?.code };
    if (response.status === 422) {
      return { status: "invalid", code: error?.code, fieldErrors: error?.fieldErrors ?? {} };
    }
    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
