import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CompanyForm } from "@/components/admin/company-form";
import { ContractForm } from "@/components/admin/contract-form";
import { StatusChip } from "@/components/admin/status-chip";
import { CompanyPeople } from "@/components/admin/company-people";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminCompanyDetail } from "@/lib/admin-companies";
import type { FleetContract } from "@/lib/admin-contracts";
import { getAdminCompany, getCompanyContracts } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.companies");
  return { title: t("detailTitle") };
}

export default async function CompanyPage({ params }: PageProps<"/[locale]/yonetim/sirketler/[id]">) {
  const t = await getTranslations("Admin.companies");
  const contractsT = await getTranslations("Admin.contracts");
  const locale = await getLocale();
  const { id } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should
  // still reach the segment's error boundary. A company that does not exist is a page that does not exist.
  let company: AdminCompanyDetail | null;
  let failed = false;
  try {
    company = await getAdminCompany(id);
  } catch {
    company = null;
    failed = true;
  }
  if (!company && !failed) notFound();

  if (!company) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/sirketler/[id]", params: { id } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  // The contracts only fill their own section, so the company still shows when they cannot be loaded.
  let contracts: FleetContract[] | null = null;
  try {
    contracts = await getCompanyContracts(id);
  } catch {
    contracts = null;
  }
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

  return (
    <>
      <PageHeader title={company.name} description={t("detailIntro", { count: company.users.length })} />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <CompanyForm key={company.updatedAt} mode="edit" row={company} />
      <section aria-labelledby="company-contracts" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-col gap-1">
          <h2 id="company-contracts" className="text-h3 text-fg">
            {contractsT("title")}
          </h2>
          <p className="text-body text-fg-muted">{contractsT("intro")}</p>
        </div>
        {contracts === null ? (
          <p role="alert" className="rounded-card border border-error p-4 text-body text-error">
            {contractsT("loadErrorText")}
          </p>
        ) : contracts.length === 0 ? (
          <p className="rounded-card border border-border p-4 text-body text-fg-muted">{contractsT("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contracts.map((contract) => (
              <li key={contract.id} className="flex flex-col gap-2 rounded-card border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={{ pathname: "/yonetim/sirketler/[id]/sozlesmeler/[number]", params: { id: company.id, number: contract.number } }} className="inline-flex min-h-11 items-center text-label text-link underline underline-offset-4">
                    {contract.number}
                  </Link>
                  <StatusChip tone={contract.status === "ACTIVE" ? "success" : "neutral"}>{contractsT(`status.${contract.status}`)}</StatusChip>
                </div>
                <p className="text-body text-fg">{contractsT(`products.${contract.productSlug as "akilli-kurumsal-filo"}`)}</p>
                <p className="text-small text-fg-muted">
                  {`${day(contract.startAt)} – ${day(contract.endAt)} · ${money.format(contract.monthlyFee / 100)} · ${contract.deliveryCity} · `}
                  {contractsT("vehiclesCount", { count: contract.vehicleCount })}
                </p>
              </li>
            ))}
          </ul>
        )}
        {contracts !== null && <ContractForm mode="create" companyId={company.id} />}
      </section>

      <CompanyPeople companyId={company.id} users={company.users} />
    </>
  );
}
