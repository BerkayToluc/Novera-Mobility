import type { QuoteRequest } from "@/lib/quote-request";

// Sample quote requests of the corporate sample account (BACKLOG Y38).
export const MOCK_QUOTE_REQUESTS: QuoteRequest[] = [
  { id: "q3", reference: "NVK-2026-48213", sentAt: "2026-10-02T09:30:00Z", fleetSize: "21-50", termMonths: "24", status: "IN_REVIEW" },
  { id: "q2", reference: "NVK-2026-31870", sentAt: "2026-08-14T13:05:00Z", fleetSize: "6-20", termMonths: "12", status: "OFFERED" },
  { id: "q1", reference: "NVK-2025-90442", sentAt: "2025-11-20T08:12:00Z", fleetSize: "1-5", termMonths: "6", status: "OFFERED" },
];
