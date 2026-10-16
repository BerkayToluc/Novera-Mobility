// A corporate quote request as the account shows it (`GET /me/quotes`). The API keeps the numbers the
// sales team reads: the form's range "6-20 vehicles" arrives as 6 (see api-forms.ts).
export type QuoteRequestStatus = "RECEIVED" | "IN_REVIEW" | "OFFERED";

export type QuoteRequest = {
  id: string;
  reference: string;
  sentAt: string;
  vehicleCount: number;
  durationMonths: number;
  status: QuoteRequestStatus;
};
