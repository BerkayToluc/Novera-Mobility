import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { RentalSearchForm } from "@/components/rental/rental-search-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { PointsToggle } from "@/components/vehicle/points-toggle";
import { RentButton } from "@/components/vehicle/rent-button";
import { ResultsViewToggle, type ResultsView } from "@/components/vehicle/results-view-toggle";
import { ResultsFilter } from "@/components/vehicle/results-filter";
import { VehicleCard } from "@/components/vehicle/vehicle-card";
import { VehicleRow } from "@/components/vehicle/vehicle-row";
import { Link } from "@/i18n/navigation";
import { getMyPoints } from "@/lib/account-client";
import type { BranchOption } from "@/lib/branch-options";
import { getAvailableVehicles } from "@/lib/fleet-client";
import { getCurrency } from "@/lib/get-currency";
import { afterPoints, redeemablePoints } from "@/lib/points";
import { getBranchOptions } from "@/lib/rental-data";
import { localToInstant, parseRentalSearch, toQuery } from "@/lib/rental-search";
import { getSession } from "@/lib/session";
import type { VehicleOffer } from "@/lib/vehicle";
import { applyVehicleFilters, parseVehicleFilters } from "@/lib/vehicle-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ResultsPage");
  // Results depend on the visitor's dates; there is nothing for a search engine to index.
  return { title: t("title"), robots: { index: false } };
}

export default async function ResultsPage({ searchParams }: PageProps<"/[locale]/araclar">) {
  const t = await getTranslations("ResultsPage");
  const format = await getFormatter();
  const currency = await getCurrency();
  const locale = (await getLocale()) as "tr" | "en";
  const params = await searchParams;
  const search = parseRentalSearch(params);
  const filters = parseVehicleFilters(params);
  const pointsChosen = (Array.isArray(params.puan) ? params.puan[0] : params.puan) === "1";
  // The list is the default; the grid is chosen with gorunum=izgara.
  const view: ResultsView = (Array.isArray(params.gorunum) ? params.gorunum[0] : params.gorunum) === "izgara" ? "grid" : "list";

  let branches: BranchOption[] | null;
  try {
    branches = await getBranchOptions();
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
  // The filters narrow what the search found; the classes on offer are those of the whole result.
  const shown = offers ? applyVehicleFilters([...offers], filters) : [];
  const classOptions = offers
    ? [...new Map(offers.map((offer) => [offer.vehicleClass.slug, offer.vehicleClass.name[locale]])).entries()].map(
        ([slug, name]) => ({ slug, name }),
      )
    : [];

  // Points can pay part of a rental for a signed-in individual account, in lira only (SPEC §2.3).
  // Without a balance the switch is replaced by an invitation to sign in.
  let balance: number | null = null;
  if (currency === "TRY" && (await getSession())?.type === "individual") {
    try {
      balance = (await getMyPoints()).balance;
    } catch {
      balance = null;
    }
  }
  const usePoints = pointsChosen && balance !== null;

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
      ) : (offers?.length ?? 0) === 0 ? (
        <StateMessage title={t("empty.title")} text={t("empty.text")} />
      ) : (
        <section aria-labelledby="results-heading" className="flex flex-col gap-6">
          {/* One bar: the count on the left; on the right the points switch, the filters and the view. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <h2 id="results-heading" className="text-h3 text-fg" aria-live="polite">
              {t("count", { count: shown.length })}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {currency === "TRY" && <PointsToggle balance={balance} on={usePoints} />}
              <ResultsFilter filters={filters} classOptions={classOptions} />
              <ResultsViewToggle view={view} />
            </div>
          </div>
          {shown.length === 0 ? (
            <StateMessage title={t("noMatch.title")} text={t("noMatch.text")}>
              <Button asChild variant="outline">
                <Link href={{ pathname: "/araclar", query: { ...toQuery(search), ...(usePoints ? { puan: "1" } : {}) } }}>
                  {t("noMatch.clear")}
                </Link>
              </Button>
            </StateMessage>
          ) : (
            <ul className={view === "grid" ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-4"}>
              {shown.map((offer) => {
                const points = usePoints ? redeemablePoints(balance ?? 0, offer.totalPrice) : 0;
                const Item = view === "grid" ? VehicleCard : VehicleRow;
                return (
                  <li key={offer.id} className={view === "grid" ? undefined : "grid"}>
                    <Item
                      vehicle={offer}
                      pointsPayment={points > 0 ? { points, rest: afterPoints(offer.totalPrice, points) } : undefined}
                      action={
                        <RentButton
                          params={{ ...toQuery(search), arac: offer.slug, ...(usePoints ? { puan: "1" } : {}) }}
                          carName={`${offer.brand} ${offer.model}`}
                        />
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
