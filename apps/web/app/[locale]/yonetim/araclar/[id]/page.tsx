import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { VehicleActions } from "@/components/admin/vehicle-actions";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getAdminVehicle, getBranchOptions } from "@/lib/admin-server";
import type { AdminVehicleDetail, BranchOption } from "@/lib/admin-vehicles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.vehicles");
  return { title: t("detailTitle") };
}

export default async function VehiclePage({ params }: PageProps<"/[locale]/yonetim/araclar/[id]">) {
  const t = await getTranslations("Admin.vehicles");
  const { id } = await params;

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI, while a rendering bug should
  // still reach the segment's error boundary. A car that does not exist is a page that does not exist.
  let vehicle: AdminVehicleDetail | null;
  let branches: BranchOption[] = [];
  let failed = false;
  try {
    [vehicle, branches] = await Promise.all([getAdminVehicle(id), getBranchOptions()]);
  } catch {
    vehicle = null;
    failed = true;
  }
  if (!vehicle && !failed) notFound();

  if (!vehicle) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/araclar/[id]", params: { id } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={vehicle.plate}
        description={t("detailIntro", { model: `${vehicle.model.brand} ${vehicle.model.model}`, branch: vehicle.branch.name })}
        action={<StatusChip tone={vehicle.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${vehicle.status}`)}</StatusChip>}
      />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <VehicleForm key={vehicle.updatedAt} mode="edit" row={vehicle} models={[]} branches={branches} />
      <VehicleActions key={"actions-" + vehicle.updatedAt} vehicle={vehicle} />
    </>
  );
}
