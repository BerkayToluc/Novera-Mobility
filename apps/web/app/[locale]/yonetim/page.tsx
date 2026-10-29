import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { SummaryCards } from "@/components/admin/summary-cards";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getAdminSummary } from "@/lib/admin-server";
import { summaryIsEmpty } from "@/lib/admin-summary";
import type { AdminSummary } from "@/lib/api-admin";

// The front door of the panel (docs/ADMIN.md §3): the day's state at a glance.
export default async function AdminSummaryPage() {
  const t = await getTranslations("Admin.summary");
  const locale = await getLocale();

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should
  // still reach the segment's error boundary.
  let summary: AdminSummary | null;
  try {
    summary = await getAdminSummary();
  } catch {
    summary = null;
  }

  // The API names the Istanbul day the numbers are for; it is written out so nobody reads "today" against another clock.
  const asOf = summary
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(summary.date + "T12:00:00Z"))
    : null;

  return (
    <>
      <PageHeader title={t("title")} description={asOf ? t("asOf", { date: asOf }) : undefined} />
      {!summary ? (
        <StateMessage tone="error" title={t("errorTitle")} text={t("errorText")}>
          <Button asChild>
            <Link href="/yonetim">{t("retry")}</Link>
          </Button>
        </StateMessage>
      ) : summaryIsEmpty(summary) ? (
        <StateMessage title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <SummaryCards summary={summary} />
      )}
    </>
  );
}
