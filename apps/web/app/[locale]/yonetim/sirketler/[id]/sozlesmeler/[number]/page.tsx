import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ContractForm } from "@/components/admin/contract-form";
import { FleetVehicleCard } from "@/components/admin/fleet-vehicle-card";
import { FleetVehicleForm } from "@/components/admin/fleet-vehicle-form";
import { PageHeader } from "@/components/admin/page-header";
import { ReadingForm } from "@/components/admin/reading-form";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { FleetContractDetail } from "@/lib/admin-contracts";
import { getAdminContract, getModelOptions } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.contracts");
  return { title: t("detailTitle") };
}

export default async function ContractPage({ params }: PageProps<"/[locale]/yonetim/sirketler/[id]/sozlesmeler/[number]">) {
  const t = await getTranslations("Admin.contracts");
  const locale = await getLocale();
  const { id, number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. A contract that does not exist, or belongs to another company than the address says, does not exist.
  let contract: FleetContractDetail | null;
  let failed = false;
  try {
    contract = await getAdminContract(number);
  } catch {
    contract = null;
    failed = true;
  }
  if ((!contract && !failed) || (contract && contract.company.id !== id)) notFound();

  if (!contract) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/sirketler/[id]/sozlesmeler/[number]", params: { id, number } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  // The models a car can be: the ones on the site. Only the form's choice needs them, so the page still shows without.
  const models = await getModelOptions(true).catch(() => []);
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const facts: Array<[string, string]> = [
    [t("facts.company"), contract.company.name],
    [t("facts.product"), t(`products.${contract.productSlug as "akilli-kurumsal-filo"}`)],
    [t("facts.period"), `${day(contract.startAt)} – ${day(contract.endAt)}`],
    [t("facts.remaining"), contract.status === "ENDED" ? t("facts.ended") : t("facts.remainingValue", { count: contract.remainingDays })],
    [t("facts.monthlyFee"), money.format(contract.monthlyFee / 100)],
    [t("facts.deliveryCity"), contract.deliveryCity],
    [t("facts.vehicles"), String(contract.vehicleCount)],
  ];

  return (
    <>
      <PageHeader
        title={contract.number}
        description={t("detailIntro", { company: contract.company.name })}
        action={<StatusChip tone={contract.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${contract.status}`)}</StatusChip>}
      />
      <Button asChild variant="outline" className="self-start">
        <Link href={{ pathname: "/yonetim/sirketler/[id]", params: { id } }}>{t("backToCompany")}</Link>
      </Button>

      <section aria-labelledby="contract-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="contract-facts" className="text-h3 text-fg">
          {t("facts.title")}
        </h2>
        <dl className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-2">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-small text-fg-muted">{term}</dt>
              <dd className="break-words text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <section aria-labelledby="contract-edit" className="flex max-w-2xl flex-col gap-3">
        <h2 id="contract-edit" className="text-h3 text-fg">
          {t("editTitle")}
        </h2>
        <ContractForm key={contract.updatedAt} mode="edit" contract={contract} />
      </section>

      <section aria-labelledby="contract-vehicles" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
        <h2 id="contract-vehicles" className="text-h3 text-fg">
          {t("vehicles.title")}
        </h2>
        <p className="text-body text-fg-muted">{t("vehicles.intro")}</p>
        {contract.vehicles.length === 0 ? (
          <p className="rounded-card border border-border p-4 text-body text-fg-muted">{t("vehicles.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contract.vehicles.map((vehicle) => (
              <FleetVehicleCard key={`${vehicle.id}-${vehicle.updatedAt}`} vehicle={vehicle} />
            ))}
          </ul>
        )}
        {contract.status === "ACTIVE" ? <FleetVehicleForm contractNumber={contract.number} models={models} /> : <p className="text-body text-fg-muted">{t("vehicles.endedText")}</p>}
        <ReadingForm key={contract.vehicles.map((vehicle) => `${vehicle.id}:${vehicle.lastKm}:${vehicle.status}`).join("|")} vehicles={contract.vehicles} />
      </section>
    </>
  );
}
