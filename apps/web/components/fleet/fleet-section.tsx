import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getBranches, getVehicles } from "@/lib/fleet-client";
import { groupFleet, type FleetCategory } from "@/lib/fleet-models";
import { getCurrency } from "@/lib/get-currency";
import { FleetExplorer } from "./fleet-explorer";

// The fleet on the home page (SPEC §2.4): a heading, the category chips and the chosen
// category's models. It loads on its own (the page shows a skeleton meanwhile) so the rest of the
// home page is not held up, and it has its own error and empty states.
export async function FleetSection({ requestedModel }: { requestedModel: string | undefined }) {
  const t = await getTranslations("FleetPage");
  const locale = (await getLocale()) as "tr" | "en";
  const currency = await getCurrency();

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
  const initialModel =
    requestedModel && categories?.some((category) => category.models.some((model) => model.slug === requestedModel))
      ? requestedModel
      : null;

  return (
    <section aria-labelledby="fleet-title" className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h2 id="fleet-title" className="text-h1 text-fg">
          {t("title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {categories === null ? (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/">{t("error.retry")}</Link>
          </Button>
        </StateMessage>
      ) : categories.length === 0 ? (
        <StateMessage title={t("empty.title")} text={t("empty.text")} />
      ) : (
        <FleetExplorer categories={categories} initialModel={initialModel} />
      )}
    </section>
  );
}
