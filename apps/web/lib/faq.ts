import type { Audience } from "./audience";
import type { LocalizedText } from "./vehicle";

// Interim shape mirroring the Prisma FaqItem; the API (BACKLOG #33, `GET /faq?audience=`)
// will return the same, with both languages per ARCHITECTURE ADR-17.
// `topic` groups the questions in the help centre (SPEC §2.9); the Prisma model has no such
// column yet, so the backend needs one before the API can serve it.
export const FAQ_TOPICS = ["rezervasyon", "odeme", "teslim", "hasar", "hesap", "kurumsal"] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

export type FaqItem = {
  id: string;
  audience: Audience;
  topic: FaqTopic;
  question: LocalizedText;
  answer: LocalizedText;
};
