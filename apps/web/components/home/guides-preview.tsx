import { getTranslations } from "next-intl/server";
import { GuideCard } from "@/components/guides/guide-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { GUIDES } from "@/lib/guides";

// Three of the guides on the home page (SPEC §2.2); the rest sit on the guides page.
const PREVIEW = GUIDES.slice(0, 3);

export async function GuidesPreview() {
  const t = await getTranslations("GuidesPage");

  return (
    <section aria-labelledby="guides-title" className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h2 id="guides-title" className="text-h1 text-fg">
            {t("homeTitle")}
          </h2>
          <p className="max-w-prose text-body text-fg-muted">{t("homeIntro")}</p>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href="/rehberler">{t("viewAll")}</Link>
        </Button>
      </header>
      <ul className="grid gap-6 md:grid-cols-3">
        {PREVIEW.map((slug) => (
          <li key={slug}>
            <GuideCard slug={slug} headingAs="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
