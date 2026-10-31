"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/admin/toast";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { cancelRequest } from "@/lib/request-actions";
import { rateLimitMessage } from "@/lib/rate-limit";

// Withdrawing a request (V2-41, docs/FLEET.md §3.1): offered only while nobody has taken it up (`RECEIVED`), and asked about first. If Novera
// took it up in the meantime the answer is a refusal, the page is read again and the button is gone.
export function RequestCancel({ number }: { number: string }) {
  const t = useTranslations("FleetPanel.requests.cancel");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    const result = await cancelRequest(number);
    setPending(false);
    setAsking(false);
    if (result.status === "ok") toast.show(t("toast", { number }));
    else if (result.status === "not_allowed") toast.show(t("errors.notAllowed"), "error");
    else if (result.status === "not_found") toast.show(t("errors.notFound"), "error");
    else if (result.status === "rate_limited") toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    else toast.show(t("errors.unavailable"), "error");
    router.refresh();
  }

  return (
    <section aria-labelledby="request-cancel" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="request-cancel" className="text-h3 text-fg">
        {t("title")}
      </h2>
      <p className="text-body text-fg-muted">{t("text")}</p>
      <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => setAsking(true)}>
        {t("button")}
      </Button>
      <ConfirmDialog open={asking} title={t("dialog.title", { number })} text={t("dialog.text")} confirmLabel={t("dialog.confirm")} cancelLabel={t("dialog.keep")} pending={pending} onCancel={() => setAsking(false)} onConfirm={() => void cancel()} />
    </section>
  );
}
