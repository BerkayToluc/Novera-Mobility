import { MessageCircleQuestion } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { FaqTabs, type FaqQuestion } from "@/components/ui/faq-tabs";
import type { Audience } from "@/lib/audience";
import { FAQ_TOPICS, type FaqTopic } from "@/lib/faq";
import { getFaq } from "@/lib/faq-client";

// The questions of the audience chosen in the rental box, in tabs by topic (SPEC §2.2.5): the same
// topics as the help centre, and only those that have a question for this audience.
export async function FaqSection({ audience }: { audience: Audience }) {
  const t = await getTranslations("HomePage.faq");
  const topics = await getTranslations("HelpPage.topics");
  const locale = (await getLocale()) as "tr" | "en";

  // Only the fetch sits in the try, so a rendering bug still reaches the error boundary.
  let items: Awaited<ReturnType<typeof getFaq>> | null = null;
  try {
    items = await getFaq(audience);
  } catch {
    items = null;
  }

  const faqData: Record<string, FaqQuestion[]> = {};
  const categories: Record<string, string> = {};
  if (items) {
    for (const topic of FAQ_TOPICS satisfies readonly FaqTopic[]) {
      const ofTopic = items.filter((item) => item.topic === topic);
      if (ofTopic.length === 0) continue;
      categories[topic] = topics(topic);
      faqData[topic] = ofTopic.map((item) => ({ id: item.id, question: item.question[locale], answer: item.answer[locale] }));
    }
  }

  return (
    <section aria-labelledby="faq-title" className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:gap-x-16 xl:gap-y-10">
      <header className="flex flex-col gap-3 xl:self-start">
        <h2 id="faq-title" className="text-h1 text-fg">
          {t("title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="xl:row-span-2">
        {items === null ? (
          <StateMessage tone="error" title={t("error.title")} text={t("error.text")} />
        ) : Object.keys(categories).length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-6 text-body text-fg-muted">{t("empty.text")}</p>
        ) : (
          // Keyed by audience, so the rental box's switch starts the tabs over on the first topic.
          <FaqTabs key={audience} label={t("tabsLabel")} categories={categories} faqData={faqData} />
        )}
      </div>

      {/* After the list on a phone, under the heading from xl up: the last thing a reader
          who did not find an answer needs. */}
      <aside className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 xl:self-start">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-link">
          <MessageCircleQuestion aria-hidden="true" className="size-5" />
        </span>
        <h3 className="text-h3 text-fg">{t("cta.title")}</h3>
        <p className="text-body text-fg-muted">{t("cta.text")}</p>
        <Button asChild variant="outline">
          <Link href={{ pathname: "/iletisim", hash: "mesaj" }}>{t("cta.button")}</Link>
        </Button>
      </aside>
    </section>
  );
}
