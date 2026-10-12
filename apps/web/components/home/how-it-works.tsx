import { ArrowRight, CalendarSearch, KeyRound, MousePointerClick } from "lucide-react";
import { getTranslations } from "next-intl/server";

const STEPS = [
  { key: "choose", icon: CalendarSearch },
  { key: "rent", icon: MousePointerClick },
  { key: "pickup", icon: KeyRound },
] as const;

// How a rental goes, in three steps, under the rental box (SPEC §2.2): for a first-time visitor
// who wants to know what happens after "Ara". A row of three on a wider screen with an arrow
// between them, one under another on a phone. Individual tab only: a corporate request has its own
// "how it goes" strip in its box.
export async function HowItWorks() {
  const t = await getTranslations("HomePage.how");

  return (
    <section aria-labelledby="how-title" className="flex flex-col gap-8">
      <h2 id="how-title" className="text-h2 text-fg">
        {t("title")}
      </h2>
      <ol className="flex flex-col gap-6 md:flex-row md:items-start md:gap-4">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="flex flex-1 items-start gap-4 md:contents">
            <div className="flex flex-1 items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-selected text-on-selected">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="sr-only">{index + 1}.</span>
                <h3 className="text-h3 text-fg">{t(`steps.${key}.title`)}</h3>
                <p className="max-w-xs text-body text-fg-muted">{t(`steps.${key}.text`)}</p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <ArrowRight aria-hidden="true" className="mt-3.5 hidden size-5 shrink-0 text-fg-subtle md:block" />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
