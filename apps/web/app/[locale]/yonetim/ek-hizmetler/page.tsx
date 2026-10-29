import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AdminExtra } from "@/lib/admin-extras";
import { getAdminExtras } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.extras");
  return { title: t("title") };
}

export default async function ExtrasPage() {
  const t = await getTranslations("Admin.extras");
  const locale = (await getLocale()) as "tr" | "en";

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: AdminExtra[] | null;
  try {
    data = await getAdminExtras();
  } catch {
    data = null;
  }

  // Whole lira without kuruş ("₺100"), otherwise both digits ("₺125,50"), so a price is never shown cut short.
  const money = (digits: number) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: "TRY", minimumFractionDigits: digits, maximumFractionDigits: digits });
  const money0 = money(0);
  const money2 = money(2);
  const columns: Column<AdminExtra>[] = [
    { key: "name", header: t("columns.name"), cell: (row) => row.name[locale] },
    { key: "pricing", header: t("columns.pricing"), cell: (row) => t(`pricing.${row.pricing}`) },
    { key: "price", header: t("columns.price"), align: "right", cell: (row) => (row.price % 100 === 0 ? money0 : money2).format(row.price / 100) },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.slug}
        rowHref={(row) => ({ pathname: "/yonetim/ek-hizmetler/[slug]", params: { slug: row.slug } })}
        sort={null}
        sortHref={() => ({ pathname: "/yonetim/ek-hizmetler" })}
        state={data ? "ready" : "error"}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
        error={{
          title: t("loadErrorTitle"),
          text: t("loadErrorText"),
          action: (
            <Button asChild variant="outline">
              <Link href="/yonetim/ek-hizmetler">{t("retry")}</Link>
            </Button>
          ),
        }}
      />
    </>
  );
}
