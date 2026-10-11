import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { GuideSlug } from "@/lib/guides";
import type { ProductSlug } from "@/lib/products";
import { PUBLIC_PAGES } from "@/lib/public-pages";
import { localizedUrl, type PageHref } from "@/lib/seo";

type Locale = (typeof routing.locales)[number];

// A short description of the site and a list of its public pages, for language models and the
// tools built on them (SPEC §9). Not an official standard, so no ranking effect is expected. It
// is built from the sitemap's own list, so a new public page shows up here without a second edit.
async function label(href: PageHref, locale: Locale): Promise<string> {
  if (typeof href === "string") {
    const t = await getTranslations({ locale, namespace: "Llms.pages" });
    // The message keys are the path names without the slash; the type cannot see that.
    return t((href === "/" ? "home" : href.slice(1)) as "home");
  }
  const { slug } = (href as { params: { slug: string } }).params;
  if (href.pathname === "/urunler/[slug]") {
    return (await getTranslations({ locale, namespace: "ProductsPage" }))(`items.${slug as ProductSlug}.title`);
  }
  return (await getTranslations({ locale, namespace: "GuidesPage" }))(`items.${slug as GuideSlug}.title`);
}

export async function GET() {
  const intro = await getTranslations({ locale: routing.defaultLocale, namespace: "Llms" });
  const lines = [`# ${intro("name")}`, "", `> ${intro("summary")}`, "", intro("note"), ""];

  for (const locale of routing.locales) {
    const t = await getTranslations({ locale, namespace: "Llms" });
    lines.push(`## ${t("language")}`, "");
    for (const href of PUBLIC_PAGES) {
      lines.push(`- [${await label(href, locale)}](${localizedUrl(href, locale)})`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
