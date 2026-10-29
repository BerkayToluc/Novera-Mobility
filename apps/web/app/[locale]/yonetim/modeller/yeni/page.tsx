import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ModelForm } from "@/components/admin/model-form";
import { PageHeader } from "@/components/admin/page-header";
import { StateMessage } from "@/components/ui/state-message";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getModelClasses } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.models");
  return { title: t("newTitle") };
}

export default async function NewModelPage() {
  const t = await getTranslations("Admin.models");
  const classes = await getModelClasses().catch(() => null);
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newIntro")} />
      {classes ? (
        <ModelForm mode="create" classes={classes} />
      ) : (
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href="/yonetim/modeller/yeni">{t("retry")}</Link>
          </Button>
        </StateMessage>
      )}
    </>
  );
}
