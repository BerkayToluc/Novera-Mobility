import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { RequestForm } from "@/components/fleet/request-form";
import { RequestHelp } from "@/components/fleet/request-help";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { currentTime } from "@/lib/clock";
import type { FleetVehiclePage } from "@/lib/fleet-panel";
import { getFleetSummary, getFleetVehicles } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.requestForm");
  return { title: t("label") };
}

// The page that opens a request (V2-41). `?tur=` and `?arac=` pre-fill the kind and the car, so a car's page can lead straight here.
export default async function NewFleetRequestPage({ searchParams }: PageProps<"/[locale]/filom/talepler/yeni">) {
  const t = await getTranslations("FleetPanel.requestForm");
  const listT = await getTranslations("FleetPanel.requests");
  const raw = await searchParams;
  const one = (name: string) => (Array.isArray(raw[name]) ? raw[name][0] : raw[name]);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let vehicles: FleetVehiclePage | null;
  try {
    vehicles = await getFleetVehicles({ page: 1, pageSize: 100, sort: { key: "plate", dir: "asc" }, q: "", filters: { durum: "kullanimda" } });
  } catch {
    vehicles = null;
  }
  // Only a company with a VIP Mobilite contract is offered the transfer (V2-42). If the summary cannot be had, it is not offered.
  const transferEnabled = await getFleetSummary().then((summary) => summary.hasVipContract).catch(() => false);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(currentTime()));

  return (
    <>
      <PageHeader title={t("label")} description={listT("intro")} />
      <RequestHelp />
      {!vehicles ? (
        <StateMessage tone="error" title={listT("loadErrorTitle")} text={listT("loadErrorText")}>
          <Button asChild variant="outline">
            <Link href="/filom/talepler/yeni">{listT("retry")}</Link>
          </Button>
        </StateMessage>
      ) : vehicles.items.length === 0 && !transferEnabled ? (
        <StateMessage title={t("noVehicles.title")} text={t("noVehicles.text")} />
      ) : (
        <RequestForm
          vehicles={vehicles.items.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.plate} · ${vehicle.model.brand} ${vehicle.model.model}` }))}
          today={today}
          initialType={one("tur")}
          initialVehicle={one("arac")}
          transferEnabled={transferEnabled}
        />
      )}
    </>
  );
}
