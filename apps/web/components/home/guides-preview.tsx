import { getTranslations } from "next-intl/server";
import { GuideCard } from "@/components/guides/guide-card";
import { GUIDES } from "@/lib/guides";
import { GuidesCarousel } from "./guides-carousel";

// All the guides on the home page, in a row to slide (SPEC §2.9). There is no "all guides"
// button: the list page is one link away in the footer and the help centre.
export async function GuidesPreview() {
  const t = await getTranslations("GuidesPage");

  return (
    <section aria-labelledby="guides-title" className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 id="guides-title" className="text-h1 text-fg">
          {t("homeTitle")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("homeIntro")}</p>
      </header>
      <GuidesCarousel>
        {GUIDES.map((slug) => (
          // The padding is the gap between cards: a margin or a gap would make three cards a
          // little wider than the strip.
          <li key={slug} className="flex shrink-0 basis-full snap-start px-3 md:basis-1/2 xl:basis-1/3">
            <GuideCard slug={slug} headingAs="h3" />
          </li>
        ))}
      </GuidesCarousel>
    </section>
  );
}
