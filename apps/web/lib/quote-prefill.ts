import { z } from "zod";

// The short corporate form on the home page (SPEC §2.2) carries its answers to the quote
// page (`/kurumsal-teklif`, BACKLOG #32) in the URL, so that page opens already filled.
export const QUOTE_TERMS = ["6", "12", "24", "36", "48"] as const;
export const QUOTE_VEHICLE_TYPES = ["economy", "compact", "executive", "suv", "electric"] as const;

export type QuotePrefillErrorMessages = {
  company: string;
  count: string;
  email: string;
};

export const quotePrefillSchema = (m: QuotePrefillErrorMessages) =>
  z.object({
    company: z.string().trim().min(1, m.company),
    // Kept as text while typing; only whole fleets from 1 to 9999 make sense.
    count: z.string().regex(/^[1-9]\d{0,3}$/, m.count),
    term: z.enum(QUOTE_TERMS),
    vehicleType: z.enum(QUOTE_VEHICLE_TYPES),
    email: z.email(m.email),
  });

export type QuotePrefillInput = z.input<ReturnType<typeof quotePrefillSchema>>;

export function toQuoteQuery(input: QuotePrefillInput) {
  return {
    firma: input.company.trim(),
    adet: input.count,
    sure: input.term,
    arac: input.vehicleType,
    eposta: input.email,
  };
}
