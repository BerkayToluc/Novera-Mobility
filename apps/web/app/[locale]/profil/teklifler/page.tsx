import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link, redirect } from "@/i18n/navigation";
import { getMyQuoteRequests } from "@/lib/account-server";
import type { QuoteRequest } from "@/lib/quote-request";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  return { title: t("quotes"), robots: { index: false } };
}

export default async function QuoteRequestsPage() {
  const t = await getTranslations("Profile.quotes");
  const format = await getFormatter();
  const session = await getSession();
  if (!session) return null;
  // Quote requests belong to a corporate account; an individual has no such page.
  if (session.type !== "corporate") redirect({ href: "/profil", locale: await getLocale() });

  // Only the fetch sits in the try, so a rendering bug still reaches the error boundary.
  let requests: QuoteRequest[] | null;
  try {
    requests = await getMyQuoteRequests();
  } catch {
    requests = null;
  }

  let content;
  if (requests === null) {
    content = (
      <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
        <Button asChild>
          <Link href="/profil/teklifler">{t("error.retry")}</Link>
        </Button>
      </StateMessage>
    );
  } else if (requests.length === 0) {
    content = (
      <StateMessage title={t("empty.title")} text={t("empty.text")}>
        <Button asChild>
          <Link href="/kurumsal-teklif">{t("empty.cta")}</Link>
        </Button>
      </StateMessage>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-4">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-h3 text-fg">{request.reference}</p>
              <p className="rounded-full bg-selected px-3 py-1 text-label text-fg">
                {t(`status.${request.status}`)}
              </p>
            </div>
            <dl className="grid gap-4 text-body md:grid-cols-3">
              <div>
                <dt className="text-small text-fg-muted">{t("sent")}</dt>
                <dd className="text-fg">
                  <time dateTime={request.sentAt}>
                    {format.dateTime(new Date(request.sentAt), { dateStyle: "long" })}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("fleet")}</dt>
                <dd className="text-fg">{t("vehicles", { count: request.vehicleCount })}</dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("term")}</dt>
                <dd className="text-fg">{t("termMonths", { months: request.durationMonths })}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 text-fg">{t("title")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </div>
      {content}
    </section>
  );
}
