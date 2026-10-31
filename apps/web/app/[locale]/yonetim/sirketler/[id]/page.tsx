import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CompanyForm } from "@/components/admin/company-form";
import { CompanyPeople } from "@/components/admin/company-people";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminCompanyDetail } from "@/lib/admin-companies";
import { getAdminCompany } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.companies");
  return { title: t("detailTitle") };
}

export default async function CompanyPage({ params }: PageProps<"/[locale]/yonetim/sirketler/[id]">) {
  const t = await getTranslations("Admin.companies");
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

  return (
    <>
      <PageHeader title={company.name} description={t("detailIntro", { count: company.users.length })} />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <CompanyForm key={company.updatedAt} mode="edit" row={company} />
      <CompanyPeople companyId={company.id} users={company.users} />
    </>
  );
}
