import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getBranchOptions, getModelOptions } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.vehicles");
  return { title: t("newTitle") };
}

export default async function NewVehiclePage() {
  const t = await getTranslations("Admin.vehicles");
  const choices = await Promise.all([getModelOptions(), getBranchOptions()]).catch(() => null);
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newIntro")} />
      {choices ? (
        <VehicleForm mode="create" models={choices[0]} branches={choices[1]} />
      ) : (
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href="/yonetim/araclar/yeni">{t("retry")}</Link>
          </Button>
        </StateMessage>
      )}
    </>
  );
}
