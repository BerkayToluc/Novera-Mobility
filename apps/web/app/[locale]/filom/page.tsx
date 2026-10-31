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

  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const statusT = await getTranslations("Admin.invoices.status");
  const invoices = summary?.invoices;

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
              <dd>
                <Link href={card.href} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                  {t("openList")}
                  <span className="sr-only">{`: ${t(`cards.${card.key}`)}`}</span>
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {invoices && (
        <section aria-labelledby="summary-invoices" className="flex flex-col gap-4">
          <h2 id="summary-invoices" className="text-h3 text-fg">
            {t("invoices.title")}
          </h2>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
              <dt className="text-label text-fg-muted">{t("invoices.thisMonth")}</dt>
              <dd className="text-display text-fg">{invoices.thisMonth ? money.format(invoices.thisMonth.total / 100) : t("invoices.notYet")}</dd>
              {invoices.thisMonth && <dd className="text-small text-fg-muted">{`${invoices.thisMonth.number} · ${statusT(invoices.thisMonth.status)}`}</dd>}
              <dd>
                <Link
                  href={invoices.thisMonth ? { pathname: "/filom/faturalar/[number]", params: { number: invoices.thisMonth.number } } : "/filom/faturalar"}
                  className="inline-flex min-h-11 items-center text-link underline underline-offset-4"
                >
                  {invoices.thisMonth ? t("invoices.openInvoice") : t("invoices.openList")}
                  <span className="sr-only">{`: ${t("invoices.thisMonth")}`}</span>
                </Link>
              </dd>
            </div>
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
              <dt className="text-label text-fg-muted">{t("invoices.unpaid")}</dt>
              <dd className="text-display text-fg">{money.format(invoices.unpaid.total / 100)}</dd>
              <dd className="text-small text-fg-muted">{t("invoices.unpaidCount", { count: invoices.unpaid.count, overdue: invoices.overdue })}</dd>
              <dd>
                <Link href={{ pathname: "/filom/faturalar", query: { durum: invoices.overdue > 0 ? "OVERDUE" : "PENDING" } }} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                  {t("invoices.openList")}
                  <span className="sr-only">{`: ${t("invoices.unpaid")}`}</span>
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      )}
      {summary && (
        <section aria-labelledby="summary-requests" className="flex flex-col gap-4">
          <h2 id="summary-requests" className="text-h3 text-fg">
            {t("requests.title")}
          </h2>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
              <dt className="text-label text-fg-muted">{t("requests.open")}</dt>
              <dd className="text-display text-fg">{summary.requests.open}</dd>
              <dd>
                <Link href={{ pathname: "/filom/talepler", query: { durum: "acik" } }} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                  {t("requests.openList")}
                  <span className="sr-only">{`: ${t("requests.open")}`}</span>
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      )}
      {summary && (
        <section aria-labelledby="summary-expenses" className="flex flex-col gap-4">
          <h2 id="summary-expenses" className="text-h3 text-fg">
            {t("expenses.title")}
          </h2>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
              <dt className="text-label text-fg-muted">{t("expenses.open")}</dt>
              <dd className="text-display text-fg">{summary.expenses.open.count}</dd>
              <dd className="text-small text-fg-muted">{t("expenses.openTotal", { total: money.format(summary.expenses.open.total / 100) })}</dd>
              <dd>
                <Link href={{ pathname: "/filom/masraflar", query: { durum: "OPEN" } }} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                  {t("expenses.openList")}
                  <span className="sr-only">{`: ${t("expenses.open")}`}</span>
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}
