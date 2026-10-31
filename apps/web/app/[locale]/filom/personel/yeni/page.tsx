import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { EmployeeForm } from "@/components/fleet/employee-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.employees");
  return { title: t("newTitle") };
}

export default async function NewFleetEmployeePage() {
  const t = await getTranslations("FleetPanel.employees");
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newIntro")} />
      <EmployeeForm mode="create" />
    </>
  );
}
