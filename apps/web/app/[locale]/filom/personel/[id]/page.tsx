import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { EmployeeActions } from "@/components/fleet/employee-actions";
import { EmployeeForm } from "@/components/fleet/employee-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { FleetEmployee } from "@/lib/fleet-panel";
import { getFleetEmployee } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.employees");
  return { title: t("detailTitle") };
}

export default async function FleetEmployeePage({ params }: PageProps<"/[locale]/filom/personel/[id]">) {
  const t = await getTranslations("FleetPanel.employees");
  const { id } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. A person who does not exist, or is another company's, is a page that does not exist.
  let employee: FleetEmployee | null;
  let failed = false;
  try {
    employee = await getFleetEmployee(id);
  } catch {
    employee = null;
    failed = true;
  }
  if (!employee && !failed) notFound();

  if (!employee) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/filom/personel/[id]", params: { id } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={employee.vehicle ? t("detailWithCar", { plate: employee.vehicle.plate }) : t("detailIntro")}
        action={<StatusChip tone={employee.active ? "success" : "neutral"}>{employee.active ? t("status.active") : t("status.inactive")}</StatusChip>}
      />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <EmployeeForm key={employee.updatedAt} mode="edit" employee={employee} />
      <EmployeeActions key={`actions-${employee.updatedAt}`} employee={employee} />
    </>
  );
}
