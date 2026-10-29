import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BranchForm } from "@/components/admin/branch-form";
import { PageHeader } from "@/components/admin/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.branches");
  return { title: t("newTitle") };
}

export default async function NewBranchPage() {
  const t = await getTranslations("Admin.branches");
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newIntro")} />
      <BranchForm mode="create" />
    </>
  );
}
