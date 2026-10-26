// What the API says about waiting after a 429: the `Retry-After` header, in seconds (ADR-27). A missing or odd
// value is `null`, and the message then says "a while" instead of a number.
export function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isInteger(seconds) && seconds >= 1 ? seconds : null;
}

// Whole minutes to show, rounded up and at least one: 90 seconds is "2 minutes", 5 seconds is "1 minute".
export function waitMinutes(retryAfter: number | null | undefined): number | null {
  if (retryAfter === null || retryAfter === undefined || retryAfter < 1) return null;
  return Math.max(1, Math.ceil(retryAfter / 60));
}

type Translate = (key: "wait" | "later", values?: { minutes: number }) => string;

// The one text for every 429 (`RateLimit` namespace in messages/*/errors.json): with the wait when the API gave
// one, without it otherwise.
export function rateLimitMessage(t: Translate, retryAfter: number | null | undefined): string {
  const minutes = waitMinutes(retryAfter);
  return minutes === null ? t("later") : t("wait", { minutes });
}
