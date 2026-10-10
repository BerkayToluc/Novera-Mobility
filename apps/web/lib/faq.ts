import type { Audience } from "./audience";
import type { LocalizedText } from "./vehicle";

// Interim shape mirroring the Prisma FaqItem; the API (BACKLOG #33, `GET /faq?audience=`)
// will return the same, with both languages per ARCHITECTURE ADR-17.
export type FaqItem = { id: string; audience: Audience; question: LocalizedText; answer: LocalizedText };
