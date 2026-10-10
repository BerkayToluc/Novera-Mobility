import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GuideCard } from "@/components/guides/guide-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { GUIDES, isGuideSlug, type GuideSection } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/rehberler/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) return {};
  const t = await getTranslations("GuidesPage");
  return pageMetadata({
    href: { pathname: "/rehberler/[slug]", params: { slug } },
    title: t(`items.${slug}.title`),
    description: t(`items.${slug}.summary`),
  });
}

export default async function GuideDetailPage({ params }: PageProps<"/[locale]/rehberler/[slug]">) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) notFound();

  const t = await getTranslations("GuidesPage");
  const sections = t.raw(`items.${slug}.sections`) as GuideSection[];
  const others = GUIDES.filter((other) => other !== slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-20">
      <Button asChild variant="ghost" className="-ml-3 mb-6">
        <Link href="/rehberler">← {t("back")}</Link>
      </Button>

      <div className="grid gap-12 xl:grid-cols-[2fr_1fr] xl:gap-16">
        <article className="flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <h1 className="text-h1 text-fg">{t(`items.${slug}.title`)}</h1>
            <p className="max-w-prose text-body text-fg-muted">{t(`items.${slug}.summary`)}</p>
          </header>
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-h2 text-fg">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="max-w-prose text-body text-fg">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>

        <aside className="flex h-fit flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-8 xl:sticky xl:top-8">
          <h2 className="text-h3 text-fg">{t("helpTitle")}</h2>
          <p className="text-body text-fg-muted">{t("helpText")}</p>
          <Button asChild size="lg">
            <Link href="/iletisim">{t("helpButton")}</Link>
          </Button>
        </aside>
      </div>

      <section aria-labelledby="more-guides" className="mt-16 flex flex-col gap-6">
        <h2 id="more-guides" className="text-h2 text-fg">
          {t("moreTitle")}
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {others.map((other) => (
            <li key={other}>
              <GuideCard slug={other} headingAs="h3" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
