import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { RequestCancel } from "@/components/fleet/request-cancel";
import { RequestFacts } from "@/components/fleet/request-facts";
import { RequestHelp } from "@/components/fleet/request-help";
import { RequestTimeline } from "@/components/fleet/request-timeline";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getFleetRequest } from "@/lib/fleet-server";
import { requestTone, type ServiceRequestDetail } from "@/lib/requests";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.requests.detail");
  return { title: t("metaTitle") };
}

export default async function FleetRequestPage({ params }: PageProps<"/[locale]/filom/talepler/[number]">) {
  const t = await getTranslations("FleetPanel.requests");
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. A request that does not exist, or is another company's, is a page that does not exist.
  let request: ServiceRequestDetail | null;
  let failed = false;
  try {
    request = await getFleetRequest(number);
  } catch {
    request = null;
    failed = true;
  }
  if (!request && !failed) notFound();

  if (!request) {
    return (
      <>
        <PageHeader title={t("detail.metaTitle")} />
        <StateMessage tone="error" title={t("detail.loadErrorTitle")} text={t("detail.loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/filom/talepler/[number]", params: { number } }}>{t("detail.retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader title={request.number} description={t("detail.intro", { type: t(`type.${request.type}`) })} action={<StatusChip tone={requestTone(request.type, request.status)}>{t(`status.${request.status}`)}</StatusChip>} />
      <Button asChild variant="outline" className="self-start">
        <Link href="/filom/talepler">{t("detail.back")}</Link>
      </Button>
      <RequestHelp />

      <section aria-labelledby="request-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="request-facts" className="text-h3 text-fg">
          {t("detail.factsTitle")}
        </h2>
        <RequestFacts request={request} />
        <p className="text-body text-fg">
          <span className="text-fg-muted">{t("detail.assignee")}: </span>
          {request.assignee ?? t("detail.noAssignee")}
        </p>
      </section>

      <section aria-labelledby="request-timeline" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
        <h2 id="request-timeline" className="text-h3 text-fg">
          {t("detail.timelineTitle")}
        </h2>
        <RequestTimeline type={request.type} events={request.events} />
      </section>

      {request.canCancel && <RequestCancel number={request.number} />}
    </>
  );
}
