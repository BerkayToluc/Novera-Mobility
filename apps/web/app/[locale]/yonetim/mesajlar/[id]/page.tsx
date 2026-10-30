import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MessageActions } from "@/components/admin/message-actions";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminMessageDetail } from "@/lib/admin-messages";
import { getAdminMessage } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.messages");
  return { title: t("detailTitle") };
}

export default async function MessagePage({ params }: PageProps<"/[locale]/yonetim/mesajlar/[id]">) {
  const t = await getTranslations("Admin.messages");
  const locale = await getLocale();
  const { id } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still
  // reach the segment's error boundary. A message that does not exist is a page that does not exist.
  let message: AdminMessageDetail | null;
  let failed = false;
  try {
    message = await getAdminMessage(id);
  } catch {
    message = null;
    failed = true;
  }
  if (!message && !failed) notFound();

  if (!message) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/mesajlar/[id]", params: { id } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
  const erased = t("erased");
  const state = message.handledAt ? "handled" : message.anonymized ? "erased" : "waiting";
  const facts: Array<[string, string]> = [
    [t("facts.from"), message.anonymized ? erased : message.name],
    [t("facts.email"), message.anonymized ? erased : message.email],
    [t("facts.phone"), message.anonymized ? erased : (message.phone ?? "—")],
    [t("facts.received"), dateTime.format(new Date(message.createdAt))],
    ...(message.handledAt
      ? ([[t("facts.handled"), message.handledBy ? t("facts.handledBy", { at: dateTime.format(new Date(message.handledAt)), name: message.handledBy.name }) : dateTime.format(new Date(message.handledAt))]] as Array<[string, string]>)
      : []),
  ];

  return (
    <>
      <PageHeader
        title={message.subject}
        description={t("detailIntro")}
        action={<StatusChip tone={state === "waiting" ? "warning" : state === "handled" ? "success" : "neutral"}>{t(`state.${state}`)}</StatusChip>}
      />

      <section aria-labelledby="message-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="message-facts" className="text-h3 text-fg">
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
      </section>

      <section aria-labelledby="message-text" className="flex max-w-2xl flex-col gap-3">
        <h2 id="message-text" className="text-h3 text-fg">
          {t("text.title")}
        </h2>
        <p className="whitespace-pre-wrap break-words rounded-card border border-border p-4 text-body text-fg">
          {message.anonymized ? t("text.erased") : message.message}
        </p>
      </section>

      <MessageActions key={message.handledAt ?? "waiting"} message={message} />
    </>
  );
}
