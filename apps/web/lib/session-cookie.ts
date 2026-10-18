// The session cookie the API sets on sign-in, sign-up and sign-out (openapi `cookieAuth`). The browser
// only talks to this web server, so the server action that made the call copies the cookie onto its
// own answer; from then on the browser sends it here and apiRequest passes it on to the API.
export const SESSION_COOKIE = "novera_session";

export type SessionCookieChange = { value: string; expires?: Date };

// Reads the `Set-Cookie` lines of an API answer. `value` is empty when the API ended the session
// (sign-out clears the cookie); undefined when the answer did not touch it.
export function parseSessionCookie(setCookies: string[]): SessionCookieChange | undefined {
  const line = setCookies.find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  if (!line) return undefined;
  const [pair, ...attributes] = line.split(";").map((part) => part.trim());
  const value = pair.slice(SESSION_COOKIE.length + 1);
  const expiresText = attributes.find((attribute) => attribute.toLowerCase().startsWith("expires="))?.slice("expires=".length);
  const expires = expiresText ? new Date(expiresText) : undefined;
  return { value, ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}) };
}
