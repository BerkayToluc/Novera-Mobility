import { z } from "zod";

// The contact form (SPEC §2.6, ARCHITECTURE ADR-20): who is writing, about what, and the
// KVKK consent. The phone is optional; everything else is required.
export const CONTACT_TOPICS = ["general", "booking", "corporate", "partnership", "feedback"] as const;

export type ContactErrorMessages = {
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: string;
};

export const contactSchema = (m: ContactErrorMessages) =>
  z.object({
    name: z.string().trim().min(2, m.name).max(80, m.name),
    email: z.email(m.email),
    // Empty is fine; when given it must look like a number with an area code.
    phone: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || (/^\+?[\d\s()-]+$/.test(value) && value.replace(/\D/g, "").length >= 10),
        m.phone,
      ),
    topic: z.enum(CONTACT_TOPICS),
    message: z.string().trim().min(10, m.message).max(2000, m.message),
    consent: z.boolean().refine((value) => value, m.consent),
    // Honeypot (ARCHITECTURE ADR-20): hidden from people, filled in by bots.
    website: z.string(),
  });

export type ContactInput = z.input<ReturnType<typeof contactSchema>>;

export const EMPTY_CONTACT: ContactInput = {
  name: "",
  email: "",
  phone: "",
  topic: "general",
  message: "",
  // Starts unticked; the schema only accepts it ticked.
  consent: false,
  website: "",
};
