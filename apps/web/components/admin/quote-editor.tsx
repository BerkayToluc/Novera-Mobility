"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { updateQuote } from "@/lib/admin-quote-actions";
import { MAX_NOTE, noteFormSchema, type AdminQuoteDetail, type QuoteSaveResult, type QuoteStatusValue } from "@/lib/admin-quotes";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

// A request is never moved back to "received", so that is not a button.
type Move = Exclude<QuoteStatusValue, "RECEIVED">;

// The state and the internal note of a quote request (V2-32, ADMIN.md §3.2). A request only goes forward (received, in review,
// offered, closed; skipping ahead is allowed), so the buttons are the states that are left, each asking first because it cannot be
// taken back. The note is for the team only: the customer never sees it. The two are saved separately, each against the version
// the page was opened at; if the request changed under the person, a warning says so and what they typed stays.
export function QuoteEditor({ quote }: { quote: AdminQuoteDetail }) {
  const t = useTranslations("Admin.quotes");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<Move | null>(null);
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const moves = quote.nextStatuses.filter((status): status is Move => status !== "RECEIVED");
  const initial = { note: quote.internalNote ?? "" };
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<{ note: string }>({
    resolver: zodResolver(noteFormSchema({ note: t("note.tooLong", { max: MAX_NOTE }) })),
    defaultValues: initial,
  });

  // What every answer that is not a success comes to: said on the page, the quote is read again where that helps.
  function problem(result: QuoteSaveResult): boolean {
    switch (result.status) {
      case "ok":
        return false;
      case "stale":
        setStale(true);
        return true;
      case "invalid_transition":
        toast.show(t("errors.invalidTransition"), "error");
        router.refresh();
        return true;
      case "invalid":
        setError("note", { message: t("note.tooLong", { max: MAX_NOTE }) });
        return true;
      case "not_found":
        setFormError(t("errors.notFound"));
        return true;
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return true;
      default:
        setFormError(t("errors.unavailable"));
        return true;
    }
  }

  async function move() {
    if (!target) return;
    setPending(true);
    setFormError(null);
    setStale(false);
    const result = await updateQuote(quote.number, quote.updatedAt, { status: target });
    setPending(false);
    setTarget(null);
    if (!problem(result)) {
      toast.show(t("toast.moved"));
      router.refresh();
    }
  }

  async function saveNote(values: { note: string }) {
    setFormError(null);
    setStale(false);
    const result = await updateQuote(quote.number, quote.updatedAt, { note: values.note });
    if (!problem(result)) {
      setDone(true);
      toast.show(t("toast.noteSaved"));
      router.refresh();
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <UnsavedChangesGuard dirty={isDirty && !done} />
      <FormError message={formError} />
      {stale && <StaleWriteBanner onReload={() => router.refresh()} />}

      <section aria-labelledby="quote-status" className="flex flex-col gap-3">
        <h2 id="quote-status" className="text-h3 text-fg">
          {t("status.title")}
        </h2>
        <p className="text-body text-fg-muted">{moves.length > 0 ? t("status.text") : t("status.closedText")}</p>
        {moves.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {moves.map((status) => (
              <Button key={status} type="button" variant={status === "CLOSED" ? "outline" : "primary"} disabled={pending} onClick={() => setTarget(status)}>
                {t(`status.move.${status}`)}
              </Button>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit(saveNote)} noValidate className="flex flex-col gap-4">
        <h2 className="text-h3 text-fg">{t("note.title")}</h2>
        <Field label={t("note.label")} hint={t("note.hint", { max: MAX_NOTE })} error={errors.note?.message}>
          {(controlProps) => <Textarea rows={5} maxLength={MAX_NOTE} {...controlProps} {...register("note")} />}
        </Field>
        <Button type="submit" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("note.saving") : t("note.save")}
        </Button>
      </form>

      <ConfirmDialog
        open={target !== null}
        title={target ? t("moveDialog.title", { number: quote.number, status: t(`state.${target}`) }) : ""}
        text={t("moveDialog.text")}
        confirmLabel={target ? t(`status.move.${target}`) : ""}
        cancelLabel={t("moveDialog.keep")}
        tone="primary"
        pending={pending}
        onCancel={() => setTarget(null)}
        onConfirm={() => void move()}
      />
    </div>
  );
}
