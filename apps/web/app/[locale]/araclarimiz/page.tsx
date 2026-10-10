import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FleetExplorer } from "@/components/fleet/fleet-explorer";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getBranches, getVehicles } from "@/lib/fleet-client";
import { groupFleet, type FleetCategory } from "@/lib/fleet-models";
import { getCurrency } from "@/lib/get-currency";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPage");
  return pageMetadata({ href: "/araclarimiz", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function FleetPage({ searchParams }: PageProps<"/[locale]/araclarimiz">) {
  const t = await getTranslations("FleetPage");
  const locale = (await getLocale()) as "tr" | "en";
  const currency = await getCurrency();
  const requested = (await searchParams).arac;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI,
  // while a rendering bug should still reach the error boundary.
  let categories: FleetCategory[] | null;
  try {
    const [vehicles, branches] = await Promise.all([getVehicles(currency), getBranches()]);
    categories = groupFleet(vehicles, branches, locale);
  } catch {
    categories = null;
  }

  // A shared link opens its model's dialog; an unknown model is ignored, not an error.
  const slug = Array.isArray(requested) ? requested[0] : requested;
  const initialModel =
    slug && categories?.some((category) => category.models.some((model) => model.slug === slug)) ? slug : null;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-10 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {categories === null ? (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/araclarimiz">{t("error.retry")}</Link>
          </Button>
        </StateMessage>
      ) : categories.length === 0 ? (
        <StateMessage title={t("empty.title")} text={t("empty.text")} />
      ) : (
        <FleetExplorer categories={categories} initialModel={initialModel} />
      )}

      <section className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-10">
        <h2 className="text-h2 text-fg">{t("ctaTitle")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("ctaText")}</p>
        <Button asChild size="lg">
          <Link href="/">{t("ctaButton")}</Link>
        </Button>
      </section>
    </div>
  );
}
