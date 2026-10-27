import { getTranslations } from "next-intl/server";
import type { Audience } from "./audience";

// The frequently asked questions (SPEC §2.2.5, §2.9). The text lives in messages/<lang>/faq.json under
// `Faq.items.<id>`; this list says which questions there are, for whom, under which topic and in which order.
// Add a question here and in both message files (tests/content.test.ts checks that they agree).
// `topic` groups the questions in the help centre.
export const FAQ_TOPICS = ["rezervasyon", "odeme", "teslim", "hasar", "hesap", "kurumsal"] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

export const FAQ_ITEMS = [
  { id: "cancel", audience: "bireysel", topic: "rezervasyon" },
  { id: "documents", audience: "bireysel", topic: "teslim" },
  { id: "returnOtherCity", audience: "bireysel", topic: "teslim" },
  { id: "priceIncludes", audience: "bireysel", topic: "odeme" },
  { id: "breakdown", audience: "bireysel", topic: "hasar" },
  { id: "realPayment", audience: "bireysel", topic: "odeme" },
  { id: "forgotPassword", audience: "bireysel", topic: "hesap" },
  { id: "deleteAccount", audience: "bireysel", topic: "hesap" },
  { id: "corporateHow", audience: "kurumsal", topic: "kurumsal" },
  { id: "corporateMultiple", audience: "kurumsal", topic: "kurumsal" },
  { id: "corporatePeriods", audience: "kurumsal", topic: "kurumsal" },
  { id: "corporatePanel", audience: "kurumsal", topic: "kurumsal" },
  { id: "corporateElectric", audience: "kurumsal", topic: "kurumsal" },
] as const satisfies readonly { id: string; audience: Audience; topic: FaqTopic }[];

export type FaqId = (typeof FAQ_ITEMS)[number]["id"];

export type FaqItem = {
  id: FaqId;
  audience: Audience;
  topic: FaqTopic;
  question: string;
  answer: string;
};

// The questions of one audience in the language of the request, in the order of FAQ_ITEMS. Nothing here can
// fail: the text is part of the build, so a visitor never sees an error state for it.
export async function getFaq(audience: Audience): Promise<FaqItem[]> {
  const t = await getTranslations("Faq.items");
  return FAQ_ITEMS.filter((item) => item.audience === audience).map((item) => ({
    ...item,
    question: t(`${item.id}.question`),
    answer: t(`${item.id}.answer`),
  }));
}
