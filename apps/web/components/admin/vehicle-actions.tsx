"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useRouter } from "@/i18n/navigation";
import { setVehicleActive } from "@/lib/admin-vehicle-actions";
import type { AdminVehicleDetail, VehicleUsage } from "@/lib/admin-vehicles";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Switching a car off and on again (V2-30, ADMIN.md §3.1). A car is never deleted: it leaves the search and cannot be booked,
// and past bookings keep it. While a booking is still to come or a hold is running on it, the switching off is refused and the
// reasons are listed with their numbers, so the person knows what to wait for. The page already knows the numbers, so the
// reasons are on screen before the button is pressed; the API's answer is the one that counts.
export function VehicleActions({ vehicle }: { vehicle: AdminVehicleDetail }) {
  const t = useTranslations("Admin.vehicles");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<VehicleUsage | null>(null);

  const inactive = vehicle.status === "INACTIVE";
  const usage = refusal ?? vehicle.usage;
  const inUse = usage.reservations > 0 || usage.holds > 0;
  // Switching on needs a model that is on the site and a branch that is open; the screen says so instead of letting the API refuse.
  const cannotReopen = vehicle.model.retired ? t("actions.modelRetired") : vehicle.branch.closed ? t("actions.branchClosed") : null;

  async function switchOff() {
    setPending(true);
    const result = await setVehicleActive(vehicle.id, vehicle.updatedAt, false);
    setPending(false);
    setOpen(false);
    if (result.status === "ok") {
      toast.show(t("toast.switchedOff"));
      router.refresh();
    } else if (result.status === "in_use") {
      setRefusal(result.usage);
    } else if (result.status === "stale") {
      toast.show(t("errors.stale"), "error");
      router.refresh();
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
  }

  async function switchOn() {
    setPending(true);
    const result = await setVehicleActive(vehicle.id, vehicle.updatedAt, true);
    setPending(false);
    if (result.status === "ok") {
      toast.show(t("toast.switchedOn"));
      router.refresh();
    } else if (result.status === "stale") {
      toast.show(t("errors.stale"), "error");
      router.refresh();
    } else if (result.status === "invalid") {
      toast.show(t("actions.cannotReopen"), "error");
    } else {
      toast.show(result.status === "rate_limited" ? rateLimitMessage(limitT, result.retryAfter) : t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="vehicle-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="vehicle-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>

      {inactive ? (
        <>
          <p className="text-body text-fg-muted">{t("actions.inactiveText")}</p>
          {cannotReopen && <p className="text-body text-fg">{cannotReopen}</p>}
          <Button type="button" variant="outline" className="self-start" disabled={pending || cannotReopen !== null} onClick={() => void switchOn()}>
            {t("actions.switchOn")}
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
            {t("actions.switchOff")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={open}
        title={t("switchOffDialog.title", { plate: vehicle.plate })}
        text={t("switchOffDialog.text")}
        confirmLabel={t("switchOffDialog.confirm")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void switchOff()}
      />
    </section>
  );
}
