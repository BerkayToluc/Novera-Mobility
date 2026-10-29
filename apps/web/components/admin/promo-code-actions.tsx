"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { PromoCode } from "@/lib/admin-promo";
import { deletePromoCode, setPromoCodeActive } from "@/lib/admin-promo-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

type Step = null | "delete" | "deactivate" | "in-use";

// Switching a code off and deleting it (V2-26, ADMIN.md §3.1). Both ask first, in words that name what will happen. A code
// that is on a booking cannot be deleted: the API refuses (`IN_USE`) and changes nothing, and the second window offers what
// that case needs, switching it off. A code that was never used is deleted for good.
export function PromoCodeActions({ row }: { row: PromoCode }) {
  const t = useTranslations("Admin.promoCodes");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(null);
  const [pending, setPending] = useState(false);

  async function switchActive(active: boolean) {
    setPending(true);
    const result = await setPromoCodeActive(row.code, row.updatedAt, active);
    setPending(false);
    setStep(null);
    if (result.status === "ok") {
      toast.show(active ? t("toast.activated") : t("toast.deactivated"));
      router.refresh();
    } else if (result.status === "stale") {
      toast.show(t("errors.staleShort"), "error");
      router.refresh();
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
  }

  async function remove() {
    setPending(true);
    const result = await deletePromoCode(row.code);
    setPending(false);
    if (result.status === "ok" || result.status === "not_found") {
      setStep(null);
      toast.show(t("toast.deleted"));
      router.push("/yonetim/kampanya-kodlari");
    } else if (result.status === "in_use") {
      setStep("in-use");
    } else {
      setStep(null);
      toast.show(result.status === "rate_limited" ? rateLimitMessage(limitT, result.retryAfter) : t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="promo-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="promo-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>
      <p className="text-body text-fg-muted">{row.used > 0 ? t("actions.usedText", { used: row.used }) : t("actions.unusedText")}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => (row.active ? setStep("deactivate") : void switchActive(true))}>
          {row.active ? t("actions.deactivate") : t("actions.activate")}
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={() => setStep("delete")}>
          {t("actions.delete")}
        </Button>
      </div>

      <ConfirmDialog
        open={step === "delete"}
        title={t("deleteDialog.title", { code: row.code })}
        text={t("deleteDialog.text")}
        confirmLabel={t("deleteDialog.confirm")}
        pending={pending}
        onCancel={() => setStep(null)}
        onConfirm={() => void remove()}
      />
      {/* Opened by the button that switches a code off, and by a delete that the API refused. The words differ. */}
      <ConfirmDialog
        open={step === "deactivate" || step === "in-use"}
        title={step === "in-use" ? t("inUseDialog.title", { code: row.code }) : t("deactivateDialog.title", { code: row.code })}
        text={step === "in-use" ? t("inUseDialog.text", { code: row.code }) : t("deactivateDialog.text")}
        confirmLabel={t("deactivateDialog.confirm")}
        tone="primary"
        pending={pending}
        onCancel={() => setStep(null)}
        onConfirm={() => void switchActive(false)}
      />
    </section>
  );
}
