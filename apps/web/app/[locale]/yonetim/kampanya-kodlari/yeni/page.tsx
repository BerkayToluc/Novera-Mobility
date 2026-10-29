import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { PromoCodeForm } from "@/components/admin/promo-code-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.promoCodes");
  return { title: t("newTitle") };
}

export default async function NewPromoCodePage() {
  const t = await getTranslations("Admin.promoCodes");
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newIntro")} />
      <PromoCodeForm mode="create" />
    </>
  );
}
