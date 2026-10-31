import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { RequestStatusForm } from "@/components/admin/request-status-form";
import { StatusChip } from "@/components/admin/status-chip";
import { RequestFacts } from "@/components/fleet/request-facts";
import { RequestTimeline } from "@/components/fleet/request-timeline";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getAdminRequest } from "@/lib/admin-server";
import { requestTone, type ServiceRequestDetail } from "@/lib/requests";

export async function generateMetadata({ params }: PageProps<"/[locale]/yonetim/talepler/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: number };
}

export default async function AdminRequestPage({ params }: PageProps<"/[locale]/yonetim/talepler/[number]">) {
  const t = await getTranslations("Admin.requests");
  const requestsT = await getTranslations("FleetPanel.requests");
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI. A request that does not exist is a page that does not exist.
  let request: ServiceRequestDetail | null;
  let failed = false;
  try {
    request = await getAdminRequest(number);
  } catch {
    request = null;
    failed = true;
  }
  if (!request && !failed) notFound();

  if (!request) {
    return (
      <>
        <PageHeader title={number} />
        <StateMessage tone="error" title={t("detail.loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/talepler/[number]", params: { number } }}>{t("detail.retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={request.number}
        description={t("detail.intro", { company: request.company.name, type: t(`type.${request.type}`) })}
        action={<StatusChip tone={requestTone(request.type, request.status)}>{t(`status.${request.status}`)}</StatusChip>}
      />
      <Button asChild variant="outline" className="self-start">
        <Link href="/yonetim/talepler">{t("detail.back")}</Link>
      </Button>

      <section aria-labelledby="request-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="request-facts" className="text-h3 text-fg">
          {requestsT("detail.factsTitle")}
        </h2>
        <RequestFacts request={request} />
        <p className="text-body text-fg">
          <span className="text-fg-muted">{t("detail.company")}: </span>
          {request.company.name}
        </p>
        <p className="text-body text-fg">
          <span className="text-fg-muted">{t("detail.assignee")}: </span>
          {request.assignee ?? t("detail.noAssignee")}
        </p>
      </section>

      <section aria-labelledby="request-timeline" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
        <h2 id="request-timeline" className="text-h3 text-fg">
          {requestsT("detail.timelineTitle")}
        </h2>
        <RequestTimeline type={request.type} events={request.events} />
      </section>

      <RequestStatusForm number={request.number} type={request.type} next={request.nextStatuses} assignee={request.assignee} />
    </>
  );
}
