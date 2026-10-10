import { MessageCircleQuestion } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { AUDIENCES, type Audience } from "@/lib/audience";
import { getFaq } from "@/lib/faq-client";
import { FaqTabs, type FaqEntry } from "./faq-tabs";

// Both audiences are fetched, so the tabs switch instantly; `audience` only says which opens first.
export async function FaqSection({ audience }: { audience: Audience }) {
  const t = await getTranslations("HomePage.faq");
  const locale = (await getLocale()) as "tr" | "en";

  // Only the fetch sits in the try, so a rendering bug still reaches the error boundary.
  let entries: Record<Audience, FaqEntry[]> | null = null;
  try {
    const sets = await Promise.all(AUDIENCES.map((value) => getFaq(value)));
    entries = Object.fromEntries(
      AUDIENCES.map((value, index) => [
        value,
        sets[index].map((item) => ({ id: item.id, question: item.question[locale], answer: item.answer[locale] })),
      ]),
    ) as Record<Audience, FaqEntry[]>;
  } catch {
    entries = null;
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
        {entries === null ? (
          <StateMessage tone="error" title={t("error.title")} text={t("error.text")} />
        ) : (
          <FaqTabs key={audience} entries={entries} initial={audience} />
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
