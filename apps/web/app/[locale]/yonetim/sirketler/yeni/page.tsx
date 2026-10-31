import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CompanyForm } from "@/components/admin/company-form";
import { PageHeader } from "@/components/admin/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.companies");
  return { title: t("newTitle") };
}

export default async function NewCompanyPage() {
  const t = await getTranslations("Admin.companies");
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newIntro")} />
      <CompanyForm mode="create" />
    </>
  );
}
