import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GuideCard } from "@/components/guides/guide-card";
import { GUIDES } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GuidesPage");
  return pageMetadata({ href: "/rehberler", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function GuidesPage() {
  const t = await getTranslations("GuidesPage");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-10 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-display text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map((slug) => (
          <li key={slug}>
            <GuideCard slug={slug} />
          </li>
        ))}
      </ul>
    </div>
  );
}
