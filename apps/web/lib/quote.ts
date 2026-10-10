import { z } from "zod";
import { isProductSlug } from "./products";

// The corporate request (SPEC §2.2.3, BACKLOG Y16): a company leaves its details and the sales
// team calls back. One form serves the home page's corporate box and /kurumsal-teklif.
export const FLEET_SIZES = ["1-5", "6-20", "21-50", "50+"] as const;
export const QUOTE_TERMS = ["6", "12", "24", "36+"] as const;
export const QUOTE_NEEDS = ["sedan", "suv", "commercial", "electric", "premium"] as const;

export type QuoteErrorMessages = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  needs: string;
  cities: string;
  consent: string;
};

export const quoteSchema = (m: QuoteErrorMessages) =>
  z.object({
    company: z.string().trim().min(1, m.company).max(120, m.company),
    contactName: z.string().trim().min(2, m.contactName).max(80, m.contactName),
    email: z.email(m.email),
    // Digits with the usual separators; at least ten digits so a local number with its area
    // code passes and a typo of a few digits does not.
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]+$/, m.phone)
      .refine((value) => value.replace(/\D/g, "").length >= 10, m.phone),
    fleetSize: z.enum(FLEET_SIZES),
    term: z.enum(QUOTE_TERMS),
    needs: z.array(z.enum(QUOTE_NEEDS)).min(1, m.needs),
    cities: z.string().trim().min(2, m.cities).max(200, m.cities),
    note: z.string().max(1000),
    // A product slug, or "" for "not decided".
    product: z.string().refine((value) => value === "" || isProductSlug(value)),
    consent: z.boolean().refine((value) => value, m.consent),
    // Honeypot (ARCHITECTURE ADR-20): hidden from people, filled in by bots.
    website: z.string(),
  });

export type QuoteInput = z.input<ReturnType<typeof quoteSchema>>;

export const emptyQuote = (product = ""): QuoteInput => ({
  company: "",
  contactName: "",
  email: "",
  phone: "",
  fleetSize: "1-5",
  term: "12",
  needs: [],
  cities: "",
  note: "",
  product,
  // Starts unticked; the schema only accepts it ticked.
  consent: false,
  website: "",
});

// Only the product travels in the URL (?urun=), from a product page's "Teklif Al". Personal
// details never do: an address bar ends up in history and server logs.
export function productFromParams(params: Record<string, string | string[] | undefined>): string {
  const raw = Array.isArray(params.urun) ? params.urun[0] : params.urun;
  return raw && isProductSlug(raw) ? raw : "";
}
