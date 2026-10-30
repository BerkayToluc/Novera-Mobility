"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cancelReservationAction } from "@/lib/admin-reservation-actions";
import { MAX_REASON, MIN_REASON, type AdminReservationDetail } from "@/lib/admin-reservations";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Cancelling a booking from the panel (V2-31, ADMIN.md §3.2). The reason is asked for in the confirmation window and written on
// the booking; the customer gets the same result as when they cancel themselves (the car is free again, spent points come back,
// waiting points go, the campaign code is free). A booking that has started or is already cancelled cannot be cancelled: the
// screen says so instead of offering the button, and the API's answer is the one that counts.
export function ReservationActions({ reservation }: { reservation: AdminReservationDetail }) {
  const t = useTranslations("Admin.reservations");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const cancelled = reservation.status === "CANCELLED";
  const started = !cancelled && !reservation.cancellable;

  function close() {
    setOpen(false);
    setProblem(null);
  }

  async function cancel() {
    if (reason.trim().length < MIN_REASON || reason.trim().length > MAX_REASON) {
      setProblem(t("cancelDialog.reasonError", { min: MIN_REASON, max: MAX_REASON }));
      return;
    }
    setPending(true);
    const result = await cancelReservationAction(reservation.number, reason);
    setPending(false);
    if (result.status === "ok") {
      close();
      setReason("");
      toast.show(t("toast.cancelled"));
      router.refresh();
    } else if (result.status === "invalid") {
      setProblem(t("cancelDialog.reasonError", { min: MIN_REASON, max: MAX_REASON }));
    } else if (result.status === "not_cancellable") {
      close();
      toast.show(t("errors.notCancellable"), "error");
      router.refresh();
    } else if (result.status === "rate_limited") {
      close();
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else {
      close();
      toast.show(t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="reservation-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="reservation-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>

      {cancelled ? (
        <p className="text-body text-fg-muted">{t("actions.cancelledText")}</p>
      ) : started ? (
        <p className="text-body text-fg-muted">{t("actions.startedText")}</p>
      ) : (
        <>
          <p className="text-body text-fg-muted">{t("actions.cancellableText")}</p>
          <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => setOpen(true)}>
            {t("actions.cancel")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={open}
        title={t("cancelDialog.title", { number: reservation.number })}
        text={t("cancelDialog.text")}
        confirmLabel={t("cancelDialog.confirm")}
        cancelLabel={t("cancelDialog.keep")}
        pending={pending}
        onCancel={close}
        onConfirm={() => void cancel()}
      >
        <Field label={t("cancelDialog.reason")} hint={t("cancelDialog.reasonHint", { min: MIN_REASON, max: MAX_REASON })} error={problem ?? undefined}>
          {(controlProps) => (
            <Textarea
              rows={4}
              maxLength={MAX_REASON}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setProblem(null);
              }}
              {...controlProps}
            />
          )}
        </Field>
      </ConfirmDialog>
    </section>
  );
}
