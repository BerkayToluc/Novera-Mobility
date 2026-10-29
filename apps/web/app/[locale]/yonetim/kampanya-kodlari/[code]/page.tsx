import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { PromoCodeActions } from "@/components/admin/promo-code-actions";
import { PromoCodeForm } from "@/components/admin/promo-code-form";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { PROMO_TONES, type PromoCode } from "@/lib/admin-promo";
import { getPromoCode } from "@/lib/admin-server";

export async function generateMetadata({ params }: PageProps<"/[locale]/yonetim/kampanya-kodlari/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: code.toLocaleUpperCase("en") };
}

export default async function PromoCodePage({ params }: PageProps<"/[locale]/yonetim/kampanya-kodlari/[code]">) {
  const t = await getTranslations("Admin.promoCodes");
  const { code } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should
  // still reach the segment's error boundary. A code that does not exist is a page that does not exist.
  let row: PromoCode | null;
  let failed = false;
  try {
    row = await getPromoCode(code);
  } catch {
    row = null;
    failed = true;
  }
  if (!row && !failed) notFound();

  if (!row) {
    return (
      <>
        <PageHeader title={code.toLocaleUpperCase("en")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/kampanya-kodlari/[code]", params: { code } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  const locale = await getLocale();
  const created = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(row.createdAt));
  return (
    <>
      <PageHeader
        title={row.code}
        description={t("detailIntro", { used: row.used, created })}
        action={<StatusChip tone={PROMO_TONES[row.status]}>{t(`status.${row.status}`)}</StatusChip>}
      />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <PromoCodeForm key={row.updatedAt} mode="edit" row={row} />
      <PromoCodeActions key={"actions-" + row.updatedAt} row={row} />
    </>
  );
}
