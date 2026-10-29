"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useRouter } from "@/i18n/navigation";
import type { AdminModelDetail, ModelUsage } from "@/lib/admin-models";
import { restoreModel, retireModel } from "@/lib/admin-model-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Retiring a model and putting it back (V2-29, ADMIN.md §3.1). A model is never deleted: it leaves the site, its cars go off, and
// past bookings keep its name. While a booking to come or a live hold still uses a car of it, the retiring is refused and the
// reasons are listed with their numbers, so the person knows what to wait for. The page already knows the numbers, so the
// reasons are on screen before the button is pressed; the API's answer is the one that counts.
export function ModelActions({ model }: { model: AdminModelDetail }) {
  const t = useTranslations("Admin.models");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<ModelUsage | null>(null);

  const retired = model.status === "RETIRED";
  const usage = refusal ?? model.usage;
  const inUse = usage.reservations > 0 || usage.holds > 0;

  async function retire() {
    setPending(true);
    const result = await retireModel(model.slug);
    setPending(false);
    setOpen(false);
    if (result.status === "ok") {
      toast.show(t("toast.retired"));
      router.refresh();
    } else if (result.status === "in_use") {
      setRefusal(result.usage);
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
  }

  async function restore() {
    setPending(true);
    const result = await restoreModel(model.slug);
    setPending(false);
    if (result.status === "ok") {
      toast.show(t("toast.restored"));
      router.refresh();
    } else {
      toast.show(result.status === "rate_limited" ? rateLimitMessage(limitT, result.retryAfter) : t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="model-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="model-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>

      {retired ? (
        <>
          <p className="text-body text-fg-muted">{t("actions.retiredText")}</p>
          <Button type="button" variant="outline" className="self-start" disabled={pending} onClick={() => void restore()}>
            {t("actions.restore")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-fg-muted">{t("actions.activeText")}</p>
          {inUse && (
            <StateMessage tone={refusal ? "error" : "empty"} title={t("actions.blockedTitle")} text={t("actions.blockedText")}>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-fg">
                {usage.reservations > 0 && <li>{t("usage.reservations", { count: usage.reservations })}</li>}
                {usage.holds > 0 && <li>{t("usage.holds", { count: usage.holds })}</li>}
              </ul>
            </StateMessage>
          )}
          <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => setOpen(true)}>
            {t("actions.retire")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={open}
        title={t("retireDialog.title", { name: `${model.brand} ${model.model}` })}
        text={t("retireDialog.text", { count: model.activeVehicles })}
        confirmLabel={t("retireDialog.confirm")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void retire()}
      />
    </section>
  );
}
