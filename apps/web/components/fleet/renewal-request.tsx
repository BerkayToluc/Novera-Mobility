"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestRenewal } from "@/lib/expense-actions";
import { rateLimitMessage } from "@/lib/rate-limit";

const MAX_NOTE = 500;

// "Yenileme talebi gönder" on the contract page (V2-38, docs/FLEET.md §3): a request to the sales team, opened with the contract's product
// and number of cars. The reference number is shown when it was received; a contract whose request is being handled says so.
export function RenewalRequest({ number }: { number: string }) {
  const t = useTranslations("FleetPanel.contract.renewal");
  const limitT = useTranslations("RateLimit");
  const id = useId();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function send() {
    if (notes.trim().length > MAX_NOTE) {
      setError(t("errors.notes"));
      return;
    }
    setPending(true);
    setError(null);
    const result = await requestRenewal(number, notes);
    setPending(false);
    switch (result.status) {
      case "ok":
        setSent(result.referenceNumber);
        setNotes("");
        return;
      case "already":
        setError(t("errors.already"));
        return;
      case "invalid":
        setError(t("errors.notes"));
        return;
      case "not_found":
        setError(t("errors.notFound"));
        return;
      case "rate_limited":
        setError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setError(t("errors.unavailable"));
    }
  }

  return (
    <section aria-labelledby="contract-renewal" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
      <h2 id="contract-renewal" className="text-h3 text-fg">
        {t("title")}
      </h2>
      <p className="text-body text-fg-muted">{t("text")}</p>
      {sent ? (
        <p role="status" className="rounded-card border border-success p-4 text-body text-fg">
          {t("sent", { number: sent })}
        </p>
      ) : (
        <>
          <FormError message={error} />
          <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-label text-fg">
              {t("notesLabel")}
            </label>
            <Textarea id={id} rows={3} maxLength={MAX_NOTE} value={notes} onChange={(event) => setNotes(event.target.value)} aria-describedby={`${id}-hint`} />
            <p id={`${id}-hint`} className="text-small text-fg-muted">
              {t("notesHint")}
            </p>
          </div>
          <Button type="button" className="self-start" disabled={pending} aria-busy={pending} onClick={() => void send()}>
            {pending ? t("sending") : t("button")}
          </Button>
        </>
      )}
    </section>
  );
}
