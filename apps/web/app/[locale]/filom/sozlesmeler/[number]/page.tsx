import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { RenewalRequest } from "@/components/fleet/renewal-request";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { FleetContractDetail } from "@/lib/fleet-panel";
import { getFleetContract } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.contract");
  return { title: t("metaTitle") };
}

export default async function FleetContractPage({ params }: PageProps<"/[locale]/filom/sozlesmeler/[number]">) {
  const t = await getTranslations("FleetPanel.contract");
  const productsT = await getTranslations("FleetPanel.contracts");
  const locale = await getLocale();
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. A contract that does not exist, or is another company's, is a page that does not exist.
  let contract: FleetContractDetail | null;
  let failed = false;
  try {
    contract = await getFleetContract(number);
  } catch {
    contract = null;
    failed = true;
  }
  if (!contract && !failed) notFound();

  if (!contract) {
    return (
      <>
        <PageHeader title={t("metaTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/filom/sozlesmeler/[number]", params: { number } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const facts: Array<[string, string]> = [
    [t("facts.product"), productsT(`products.${contract.productSlug as "akilli-kurumsal-filo"}`)],
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
        description={t("intro")}
        action={<StatusChip tone={contract.status === "ACTIVE" ? "success" : "neutral"}>{productsT(`status.${contract.status}`)}</StatusChip>}
      />
      <Button asChild variant="outline" className="self-start">
        <Link href="/filom/sozlesmeler">{t("back")}</Link>
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
        <p className="text-small text-fg-muted">{productsT("currencyNote")}</p>
      </section>

      {contract.status === "ACTIVE" && <RenewalRequest number={contract.number} />}

      <section aria-labelledby="contract-vehicles" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
        <h2 id="contract-vehicles" className="text-h3 text-fg">
          {t("vehicles.title")}
        </h2>
        {contract.vehicles.length === 0 ? (
          <p className="rounded-card border border-border p-4 text-body text-fg-muted">{t("vehicles.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contract.vehicles.map((vehicle) => (
              <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-4">
                <div className="flex flex-col">
                  <Link href={{ pathname: "/filom/araclar/[plate]", params: { plate: vehicle.plate.replace(/ /g, "") } }} className="inline-flex min-h-11 items-center text-label text-link underline underline-offset-4">
                    {vehicle.plate}
                  </Link>
                  <span className="text-small text-fg-muted">{`${vehicle.model.brand} ${vehicle.model.model} · ${vehicle.year}`}</span>
                </div>
                <StatusChip tone={vehicle.status === "ACTIVE" ? "success" : "neutral"}>{vehicle.status === "ACTIVE" ? (vehicle.assignee?.name ?? t("vehicles.idle")) : t("vehicles.returned")}</StatusChip>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
