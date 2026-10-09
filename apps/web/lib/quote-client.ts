import type { QuoteInput } from "./quote-prefill";

// `POST /quotes` does not exist yet (BACKLOG #33). Until it does this says so plainly
// instead of pretending the request was sent: a made-up "received" screen would tell a
// company its request is being handled when nobody will ever see it. When the API lands,
// only this file changes; the form already handles sending and failure.
export class QuoteUnavailableError extends Error {
  constructor() {
    super("The quote service is not connected yet.");
    this.name = "QuoteUnavailableError";
  }
}

export async function submitQuote(input: QuoteInput): Promise<void> {
  void input;
  throw new QuoteUnavailableError();
}
