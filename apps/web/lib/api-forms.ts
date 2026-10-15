import type { ContactInput } from "./contact";
import type { QuoteInput } from "./quote";

// How the two forms are shaped for the API (docs/api/openapi.yaml, `QuoteRequest` and
// `ContactRequest`). Pure functions, kept apart from the server actions so they can be tested.

// The form asks for a range ("6-20 vehicles"), the API takes a number. The lower end is sent
// (G's decision, 16 October: option A of the backend's proposal): the sales team sees "6" where
// the customer chose "6-20". Keeping the range itself would mean a change to the contract.
export const FLEET_COUNT = { "1-5": 1, "6-20": 6, "21-50": 21, "50+": 50 } as const;

// "36+" is sent as 36 for the same reason.
export const TERM_MONTHS: Record<string, number> = { "1": 1, "2": 2, "3": 3, "6": 6, "12": 12, "24": 24, "36+": 36 };

export function quoteToApi(input: QuoteInput) {
  return {
    companyName: input.company,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    vehicleCount: FLEET_COUNT[input.fleetSize],
    durationMonths: TERM_MONTHS[input.term],
    // The API does not check this one: the needs travel as "sedan,suv".
    vehicleType: input.needs.join(","),
    deliveryCities: input.cities,
    notes: input.note,
    productSlug: input.product,
    consent: input.consent,
    website: input.website,
  };
}

// The API has a free-text subject, not a topic: the topic's Turkish name is sent, which is what
// the team reading the message wants to see.
export const TOPIC_SUBJECT = {
  general: "Genel",
  booking: "Rezervasyon",
  corporate: "Kurumsal",
  partnership: "İş birliği",
  feedback: "Geri bildirim",
} as const;

export function contactToApi(input: ContactInput) {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: TOPIC_SUBJECT[input.topic],
    message: input.message,
    consent: input.consent,
    website: input.website,
  };
}
