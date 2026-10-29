import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ExtraForm } from "@/components/admin/extra-form";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminExtra } from "@/lib/admin-extras";
import { getAdminExtra } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.extras");
  return { title: t("detailTitle") };
}

export default async function ExtraPage({ params }: PageProps<"/[locale]/yonetim/ek-hizmetler/[slug]">) {
  const t = await getTranslations("Admin.extras");
  const locale = (await getLocale()) as "tr" | "en";
  const { slug } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still
  // reach the segment's error boundary. An extra that does not exist is a page that does not exist.
  let extra: AdminExtra | null;
  let failed = false;
  try {
    extra = await getAdminExtra(slug);
  } catch {
    extra = null;
    failed = true;
  }
  if (!extra && !failed) notFound();

  if (!extra) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/ek-hizmetler/[slug]", params: { slug } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader title={extra.name[locale]} description={t("detailIntro")} />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <ExtraForm key={extra.updatedAt} row={extra} />
    </>
  );
}
