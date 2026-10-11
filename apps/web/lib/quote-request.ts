import type { FLEET_SIZES, QUOTE_TERMS } from "./quote";

// Interim shape of a corporate quote request as the account shows it (BACKLOG Y38); the API
// (`GET /me/quotes`, with the quote work of Y35) will return the same.
export type QuoteRequestStatus = "RECEIVED" | "IN_REVIEW" | "OFFERED";

export type QuoteRequest = {
  id: string;
  reference: string;
  sentAt: string;
  fleetSize: (typeof FLEET_SIZES)[number];
  termMonths: (typeof QUOTE_TERMS)[number];
  status: QuoteRequestStatus;
};
