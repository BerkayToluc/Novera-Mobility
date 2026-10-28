import "server-only";
import { parseRetryAfter } from "./rate-limit";
import { cookies } from "next/headers";
import { apiHeaders } from "./api-headers";
import { parseSessionCookie, SESSION_COOKIE, type SessionCookieChange } from "./session-cookie";

// What came back from a call to the API: a signed-in read (401), a booking that was taken (409), a missing
// record (404), an empty answer (204 and 202). `code` is the API's machine code (`VEHICLE_UNAVAILABLE`,
// `RESET_TOKEN_INVALID`). The forms use `apiPost` below, which keeps only the outcomes they need.
export type ApiResult<T> =
  // `sessionCookie` is set when the answer started or ended the session (sign-in, sign-up, sign-out).
  | { status: "ok"; data: T; sessionCookie?: SessionCookieChange }
  | { status: "invalid"; code?: string; fieldErrors: Record<string, string> }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "forbidden"; code?: string }
  | { status: "conflict"; code?: string }
  | { status: "rate_limited"; retryAfter: number | null }
  // `code` is set when the API itself answered (a 5xx with its own code); not when it could not be reached.
  | { status: "unavailable"; code?: string };

type ErrorBody = { code?: string; fieldErrors?: Record<string, string> };

// A call from the server to the API on behalf of the visitor: their address (`X-Novera-Client-IP`, so
// the per-address limits see them and not this server), the shared key (`X-Novera-Key`) and their
// session cookie travel along.
// Without API_URL the service is simply not there.
export async function apiRequest<T = null>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
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
    if (response.status === 429) return { status: "rate_limited", retryAfter: parseRetryAfter(response.headers.get("retry-after")) };
    const error = (await response.json().catch(() => null)) as ErrorBody | null;
    if (response.status === 403) return { status: "forbidden", code: error?.code };
    if (response.status === 409) return { status: "conflict", code: error?.code };
    if (response.status === 422) {
      return { status: "invalid", code: error?.code, fieldErrors: error?.fieldErrors ?? {} };
    }
    return { status: "unavailable", code: error?.code };
  } catch {
    return { status: "unavailable" };
  }
}

// What the contact and quote forms need of a JSON POST (ARCHITECTURE ADR-14, ADR-20): it worked, the API found a
// field wrong, the honeypot caught a bot, the visitor sent too many, or the service is not there. It is `apiRequest`
// with the other outcomes folded into "unavailable" (V2-14, QUALITY M-05: this was a second copy of the client).
export type ApiPostResult<T> =
  | { status: "ok"; data: T }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "spam" }
  | { status: "rate_limited"; retryAfter: number | null }
  | { status: "unavailable" };

export async function apiPost<T>(path: string, body: unknown): Promise<ApiPostResult<T>> {
  const result = await apiRequest<T>("POST", path, body);
  switch (result.status) {
    case "ok":
      return { status: "ok", data: result.data };
    case "invalid":
      // A bot: the caller answers as if it worked and keeps nothing (ADR-20).
      return result.code === "SPAM_DETECTED" ? { status: "spam" } : { status: "invalid", fieldErrors: result.fieldErrors };
    case "rate_limited":
      return result;
    default:
      return { status: "unavailable" };
  }
}
