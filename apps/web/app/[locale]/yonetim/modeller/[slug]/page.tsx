import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ModelActions } from "@/components/admin/model-actions";
import { ModelForm } from "@/components/admin/model-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminModelDetail, ModelClass } from "@/lib/admin-models";
import { getAdminModel, getModelClasses } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.models");
  return { title: t("detailTitle") };
}

export default async function ModelPage({ params }: PageProps<"/[locale]/yonetim/modeller/[slug]">) {
  const t = await getTranslations("Admin.models");
  const { slug } = await params;

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI, while a rendering bug should
  // still reach the segment's error boundary. A model that does not exist is a page that does not exist.
  let model: AdminModelDetail | null;
  let classes: ModelClass[] = [];
  let failed = false;
  try {
    [model, classes] = await Promise.all([getAdminModel(slug), getModelClasses()]);
  } catch {
    model = null;
    failed = true;
  }
  if (!model && !failed) notFound();

  if (!model) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/modeller/[slug]", params: { slug } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${model.brand} ${model.model}`}
        description={t("detailIntro", { count: model.activeVehicles })}
        action={<StatusChip tone={model.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${model.status}`)}</StatusChip>}
      />
      {/* Keyed by the version: after a save, or "load the current record", the form starts again from what is stored. */}
      <ModelForm key={model.updatedAt} mode="edit" row={model} classes={classes} />
      <ModelActions key={"actions-" + model.updatedAt} model={model} />
    </>
  );
}
