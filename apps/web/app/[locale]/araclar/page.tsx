import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { RentalSearchForm } from "@/components/rental/rental-search-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { VehicleCard } from "@/components/vehicle/vehicle-card";
import { Link } from "@/i18n/navigation";
import type { BranchOption } from "@/lib/branch-options";
import { getAvailableVehicles } from "@/lib/fleet-client";
import { getCurrency } from "@/lib/get-currency";
import { getBranchOptions } from "@/lib/rental-data";
import { localToInstant, parseRentalSearch } from "@/lib/rental-search";
import type { VehicleOffer } from "@/lib/vehicle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ResultsPage");
  // Results depend on the visitor's dates; there is nothing for a search engine to index.
  return { title: t("title"), robots: { index: false } };
}

export default async function ResultsPage({ searchParams }: PageProps<"/[locale]/araclar">) {
  const t = await getTranslations("ResultsPage");
  const format = await getFormatter();
  const currency = await getCurrency();
  const search = parseRentalSearch(await searchParams);

  let branches: BranchOption[] | null;
  try {
    branches = await getBranchOptions(currency);
  } catch {
    branches = null;
  }

  // Only the fetches sit in try blocks: a failure to load is an expected state with its own
  // UI, while a rendering bug should still reach the error boundary.
  let offers: VehicleOffer[] | null = null;
  if (search && branches) {
    try {
      offers = await getAvailableVehicles(search, currency);
    } catch {
      offers = null;
    }
  }
  const failed = branches === null || (search !== null && offers === null);
  const sorted = offers ? [...offers].sort((a, b) => a.dailyPrice.amount - b.dailyPrice.amount) : [];

  const labelOf = (id: string) => branches?.find((branch) => branch.id === id)?.label ?? id;
  const moment = (local: string) =>
    format.dateTime(localToInstant(local), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">
      <h1 className="text-h1 text-fg">{t("title")}</h1>

      {branches && (
        // The search stays at the top as a one-line summary; opening it shows the form with
        // the same values, so dates or branches can be changed and searched again.
        <details open={search === null} className="group rounded-card border border-border bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col gap-1">
              {search ? (
                <>
                  <span className="text-label text-fg">
                    {labelOf(search.pickupBranchId)}
                    {search.returnBranchId !== search.pickupBranchId && ` → ${labelOf(search.returnBranchId)}`}
                  </span>
                  <span className="text-small text-fg-muted">
                    {moment(search.startAt)} – {moment(search.endAt)}
                  </span>
                </>
              ) : (
                <span className="text-label text-fg">{t("searchTitle")}</span>
              )}
            </span>
            <span className="inline-flex items-center gap-2 text-label text-link">
              {t("change")}
              <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-border p-4 md:p-6">
            <div className="max-w-3xl">
              <RentalSearchForm branches={branches} initial={search ?? undefined} />
            </div>
          </div>
        </details>
      )}

      {failed ? (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/">{t("error.back")}</Link>
          </Button>
        </StateMessage>
      ) : !search ? (
        <StateMessage title={t("noSearch.title")} text={t("noSearch.text")} />
      ) : sorted.length === 0 ? (
        <StateMessage title={t("empty.title")} text={t("empty.text")} />
      ) : (
        <section aria-labelledby="results-heading" className="flex flex-col gap-6">
          <h2 id="results-heading" className="text-h3 text-fg">
            {t("count", { count: sorted.length })}
          </h2>
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((offer) => (
              <li key={offer.id}>
                <VehicleCard vehicle={offer} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
