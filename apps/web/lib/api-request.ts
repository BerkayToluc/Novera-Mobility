import "server-only";
import { cookies } from "next/headers";
import { apiHeaders } from "./api-headers";
import { parseSessionCookie, SESSION_COOKIE, type SessionCookieChange } from "./session-cookie";

// What came back from a call to the API, for the calls that need more outcomes than api-post.ts
// offers: a signed-in read (401), a booking that was taken (409), a missing record (404), an empty
// answer (204 and 202). `code` is the API's machine code (`VEHICLE_UNAVAILABLE`, `RESET_TOKEN_INVALID`).
export type ApiResult<T> =
  // `sessionCookie` is set when the answer started or ended the session (sign-in, sign-up, sign-out).
  | { status: "ok"; data: T; sessionCookie?: SessionCookieChange }
  | { status: "invalid"; code?: string; fieldErrors: Record<string, string> }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "conflict"; code?: string }
  | { status: "rate_limited" }
  | { status: "unavailable" };

type ErrorBody = { code?: string; fieldErrors?: Record<string, string> };

// A call from the server to the API on behalf of the visitor: their address (`X-Novera-Client-IP`, so
// the per-address limits see them and not this server), the shared key (`X-Novera-Key`) and their
// session cookie travel along.
// Without API_URL the service is simply not there.
export async function apiRequest<T = null>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const base = process.env.API_URL;
  if (!base) return { status: "unavailable" };

  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(await apiHeaders()),
        ...(session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (response.ok) {
      const sessionCookie = parseSessionCookie(response.headers.getSetCookie());
      // 202 and 204 carry no body; reading one would throw.
      if (response.status === 202 || response.status === 204) return { status: "ok", data: null as T, sessionCookie };
      return { status: "ok", data: (await response.json()) as T, sessionCookie };
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
