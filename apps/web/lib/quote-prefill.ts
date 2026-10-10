import { z } from "zod";
import { isProductSlug } from "./products";

// The corporate quote form (SPEC §2.2, §2.3). The short form on the home page and the
// product pages carry their answers to `/kurumsal-teklif` in the URL, so it opens filled.
export const QUOTE_TERMS = ["6", "12", "24", "36", "48"] as const;
export const QUOTE_VEHICLE_TYPES = ["economy", "compact", "executive", "suv", "electric"] as const;

export type QuoteErrorMessages = {
  company: string;
  count: string;
  email: string;
};

export const quoteSchema = (m: QuoteErrorMessages) =>
  z.object({
    company: z.string().trim().min(1, m.company),
    // Kept as text while typing; only whole fleets from 1 to 9999 make sense.
    count: z.string().regex(/^[1-9]\d{0,3}$/, m.count),
    term: z.enum(QUOTE_TERMS),
    vehicleType: z.enum(QUOTE_VEHICLE_TYPES),
    email: z.email(m.email),
    // A product slug, or "" for "not decided". The home form leaves it empty.
    product: z.string().refine((value) => value === "" || isProductSlug(value)),
  });

export type QuoteInput = z.input<ReturnType<typeof quoteSchema>>;

export const EMPTY_QUOTE: QuoteInput = {
  company: "",
  count: "",
  term: "12",
  vehicleType: "economy",
  email: "",
  product: "",
};

export function toQuoteQuery(input: QuoteInput) {
  return {
    firma: input.company.trim(),
    adet: input.count,
    sure: input.term,
    arac: input.vehicleType,
    eposta: input.email,
  };
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const oneOf = <T extends string>(list: readonly T[], value: string | undefined): T | undefined =>
  list.find((item) => item === value);

// The URL is typed by anyone, so every value is checked and a bad one falls back to the
// form's default instead of failing the page.
export function parseQuotePrefill(params: RawParams): QuoteInput {
  const count = first(params.adet);
  const product = first(params.urun);
  const email = first(params.eposta);
  return {
    company: (first(params.firma) ?? "").slice(0, 120),
    count: count && /^[1-9]\d{0,3}$/.test(count) ? count : EMPTY_QUOTE.count,
    term: oneOf(QUOTE_TERMS, first(params.sure)) ?? EMPTY_QUOTE.term,
    vehicleType: oneOf(QUOTE_VEHICLE_TYPES, first(params.arac)) ?? EMPTY_QUOTE.vehicleType,
    email: email && z.email().safeParse(email).success ? email : "",
    product: product && isProductSlug(product) ? product : "",
  };
}
