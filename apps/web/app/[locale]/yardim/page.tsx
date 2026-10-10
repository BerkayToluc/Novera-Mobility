import type { Metadata } from "next";
import { BookOpen, MessageCircleQuestion } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { GuideCard } from "@/components/guides/guide-card";
import { HelpCentre, type HelpEntry } from "@/components/help/help-centre";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { AUDIENCES } from "@/lib/audience";
import { FAQ_TOPICS } from "@/lib/faq";
import { getFaq } from "@/lib/faq-client";
import { GUIDES } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HelpPage");
  return pageMetadata({ href: "/yardim", title: t("metaTitle"), description: t("metaDescription") });
}

// The questions come from the same source as the home page's FAQ (SPEC §2.9), both audiences
// together, grouped by topic.
export default async function HelpPage() {
  const t = await getTranslations("HelpPage");
  const locale = (await getLocale()) as "tr" | "en";

  // Only the fetch sits in the try, so a rendering bug still reaches the error boundary.
  let entries: HelpEntry[] | null = null;
  try {
    const sets = await Promise.all(AUDIENCES.map((audience) => getFaq(audience)));
    entries = sets.flat().map((item) => ({
      id: item.id,
      topic: item.topic,
      question: item.question[locale],
      answer: item.answer[locale],
    }));
  } catch {
    entries = null;
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-display text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {entries === null ? (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")} />
      ) : entries.length === 0 ? (
        <StateMessage title={t("empty.title")} text={t("empty.text")} />
      ) : (
        <HelpCentre entries={entries} topics={[...FAQ_TOPICS]} />
      )}

      <section aria-labelledby="help-guides" className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted text-link">
              <BookOpen aria-hidden="true" className="size-5" />
            </span>
            <h2 id="help-guides" className="text-h2 text-fg">
              {t("guidesTitle")}
            </h2>
          </div>
          <Button asChild variant="outline" className="self-start">
            <Link href="/rehberler">{t("guidesAll")}</Link>
          </Button>
        </header>
        <ul className="grid gap-6 md:grid-cols-3">
          {GUIDES.slice(0, 3).map((slug) => (
            <li key={slug}>
              <GuideCard slug={slug} headingAs="h3" />
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-8">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-link">
          <MessageCircleQuestion aria-hidden="true" className="size-5" />
        </span>
        <h2 className="text-h3 text-fg">{t("cta.title")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("cta.text")}</p>
        <Button asChild>
          <Link href={{ pathname: "/iletisim", hash: "mesaj" }}>{t("cta.button")}</Link>
        </Button>
      </aside>
    </div>
  );
}
