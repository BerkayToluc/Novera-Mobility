import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { FleetSummary } from "@/lib/fleet-panel";
import { getFleetSummary } from "@/lib/fleet-server";

// The front door of Filom (docs/FLEET.md §3): the state of the fleet at a glance. Each card opens the list it counts, narrowed the same
// way, so the number on the card is the total of the list it opens.
export default async function FleetSummaryPage() {
  const t = await getTranslations("FleetPanel.summary");
  const locale = await getLocale();

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary.
  let summary: FleetSummary | null;
  try {
    summary = await getFleetSummary();
  } catch {
    summary = null;
  }

  // The API names the Istanbul day the numbers are for; it is written out so nobody reads "today" against another clock.
  const asOf = summary ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(summary.date + "T12:00:00Z")) : null;

  const cards = summary
    ? ([
        { key: "vehicles", value: summary.vehicles.total, href: { pathname: "/filom/araclar", query: { durum: "kullanimda" } } },
        { key: "assigned", value: summary.vehicles.assigned, href: { pathname: "/filom/araclar", query: { durum: "kullanimda", zimmet: "zimmetli" } } },
        { key: "idle", value: summary.vehicles.idle, href: { pathname: "/filom/araclar", query: { durum: "kullanimda", zimmet: "bosta" } } },
        { key: "contracts", value: summary.contracts.active, href: { pathname: "/filom/sozlesmeler", query: { durum: "ACTIVE" } } },
        { key: "endingSoon", value: summary.contracts.endingSoon, href: { pathname: "/filom/sozlesmeler", query: { durum: "ACTIVE" } } },
        { key: "maintenanceDue", value: summary.maintenanceDue, href: { pathname: "/filom/araclar", query: { durum: "kullanimda" } } },
      ] as const)
    : [];

  return (
    <>
      <PageHeader title={t("title")} description={asOf ? t("asOf", { date: asOf }) : undefined} />
      {!summary ? (
        <StateMessage tone="error" title={t("errorTitle")} text={t("errorText")}>
          <Button asChild>
            <Link href="/filom">{t("retry")}</Link>
          </Button>
        </StateMessage>
      ) : (
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.key} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
              <dt className="text-label text-fg-muted">{t(`cards.${card.key}`)}</dt>
              <dd className="text-display text-fg">{card.value}</dd>
              <Link href={card.href} className="inline-flex min-h-11 items-center self-start text-link underline underline-offset-4">
                {t("openList")}
                <span className="sr-only">{`: ${t(`cards.${card.key}`)}`}</span>
              </Link>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
