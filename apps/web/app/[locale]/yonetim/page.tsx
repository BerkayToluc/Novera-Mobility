import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StateMessage } from "@/components/ui/state-message";

// The summary screen comes in V2-25; until then the front door says the panel is ready.
export default async function AdminSummaryPage() {
  const t = await getTranslations("Admin.summary");
  return (
    <>
      <PageHeader title={t("title")} />
      <StateMessage title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}
