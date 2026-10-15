import "server-only";
import { cookies, headers } from "next/headers";

// What came back from a JSON POST to the API (ARCHITECTURE ADR-14, ADR-20). The forms need only
// these outcomes: it worked, the API found a field wrong, the honeypot caught a bot, the visitor
// sent too many, or the service is not there (no API_URL, a 5xx, the network).
export type ApiPostResult<T> =
  | { status: "ok"; data: T }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "spam" }
  | { status: "rate_limited" }
  | { status: "unavailable" };

// The name of the session cookie the API sets (openapi `cookieAuth`).
const SESSION_COOKIE = "novera_session";

// A JSON POST from a server action to the API. Two things from the visitor's own request are passed
// on, because from here the API would otherwise see only this server:
// - the visitor's address (`X-Forwarded-For`): the API limits forms per address (ten an hour), and
//   without it every visitor would share one limit and the eleventh form on the whole site would be
//   refused;
// - the session cookie, so a signed-in corporate account's quote is tied to the account.
export async function apiPost<T>(path: string, body: unknown): Promise<ApiPostResult<T>> {
  const base = process.env.API_URL;
  if (!base) return { status: "unavailable" };

  const forwarded = (await headers()).get("x-forwarded-for");
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(forwarded ? { "X-Forwarded-For": forwarded } : {}),
        ...(session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.ok) return { status: "ok", data: (await response.json()) as T };
    if (response.status === 429) return { status: "rate_limited" };
    if (response.status === 422) {
      const error = (await response.json().catch(() => null)) as {
        code?: string;
        fieldErrors?: Record<string, string>;
      } | null;
      // A bot: the caller answers as if it worked and keeps nothing (ADR-20).
      if (error?.code === "SPAM_DETECTED") return { status: "spam" };
      return { status: "invalid", fieldErrors: error?.fieldErrors ?? {} };
    }
    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
