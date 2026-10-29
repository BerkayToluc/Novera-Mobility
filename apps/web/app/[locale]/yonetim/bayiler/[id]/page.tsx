import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BranchActions } from "@/components/admin/branch-actions";
import { BranchForm } from "@/components/admin/branch-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminBranchDetail } from "@/lib/admin-branches";
import { getAdminBranch } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.branches");
  return { title: t("detailTitle") };
}

export default async function BranchPage({ params }: PageProps<"/[locale]/yonetim/bayiler/[id]">) {
  const t = await getTranslations("Admin.branches");
  const { id } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should
  // still reach the segment's error boundary. A branch that does not exist is a page that does not exist.
  let branch: AdminBranchDetail | null;
  let failed = false;
  try {
    branch = await getAdminBranch(id);
  } catch {
    branch = null;
    failed = true;
  }
  if (!branch && !failed) notFound();

  if (!branch) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/bayiler/[id]", params: { id } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={branch.name}
        description={t("detailIntro", { city: branch.city })}
        action={<StatusChip tone={branch.status === "OPEN" ? "success" : "neutral"}>{t(`status.${branch.status}`)}</StatusChip>}
      />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <BranchForm key={branch.updatedAt} mode="edit" row={branch} />
      <BranchActions key={"actions-" + branch.updatedAt} branch={branch} />
    </>
  );
}
