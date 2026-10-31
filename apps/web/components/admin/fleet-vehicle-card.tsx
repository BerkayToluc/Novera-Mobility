"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { returnFleetVehicle } from "@/lib/admin-contract-actions";
import type { FleetVehicle } from "@/lib/admin-contracts";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { StatusChip } from "./status-chip";
import { useToast } from "./toast";

// A fleet car of a contract and giving it back (V2-35, ADMIN.md §3.12). Giving the car back is asked about: the car leaves the fleet in
// use, the assignment it has ends, and it cannot be changed after (it is history). A car is never deleted.
export function FleetVehicleCard({ vehicle }: { vehicle: FleetVehicle }) {
  const t = useTranslations("Admin.contracts");
  const limitT = useTranslations("RateLimit");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const day = (value: string | null) => (value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—");
  const km = new Intl.NumberFormat(locale);
  const returned = vehicle.status === "RETURNED";

  async function giveBack() {
    setPending(true);
    const result = await returnFleetVehicle(vehicle.id, vehicle.updatedAt);
    setPending(false);
    setOpen(false);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.returned"));
        router.refresh();
        return;
      case "stale":
      case "not_allowed":
        toast.show(t("errors.vehicleChanged"), "error");
        router.refresh();
        return;
      case "rate_limited":
        toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
        return;
      case "not_found":
        toast.show(t("errors.vehicleNotFound"), "error");
        return;
      default:
        toast.show(t("errors.unavailable"), "error");
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-card border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-fg">{vehicle.plate}</p>
        <StatusChip tone={returned ? "neutral" : "success"}>{returned ? t("vehicle.returned") : t("vehicle.active")}</StatusChip>
      </div>
      <p className="text-body text-fg-muted">{`${vehicle.model.brand} ${vehicle.model.model} · ${vehicle.year}`}</p>
      <dl className="grid gap-2 text-small md:grid-cols-2">
        <div>
          <dt className="text-fg-muted">{t("vehicle.km")}</dt>
          <dd className="text-fg">{t("vehicle.kmValue", { km: km.format(vehicle.lastKm) })}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t("vehicle.assignee")}</dt>
          <dd className="text-fg">{returned ? t("vehicle.returnedOn", { date: day(vehicle.returnedAt?.slice(0, 10) ?? null) }) : (vehicle.assignee?.name ?? t("vehicle.idle"))}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t("vehicle.maintenance")}</dt>
          <dd className="text-fg">{day(vehicle.nextMaintenanceOn)}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t("vehicle.inspection")}</dt>
          <dd className="text-fg">{day(vehicle.inspectionDueOn)}</dd>
        </div>
      </dl>
      {!returned && (
        <Button type="button" variant="outline" className="self-start" disabled={pending} aria-label={t("vehicle.giveBackFor", { plate: vehicle.plate })} onClick={() => setOpen(true)}>
          {t("vehicle.giveBack")}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        title={t("giveBackDialog.title", { plate: vehicle.plate })}
        text={t("giveBackDialog.text")}
        confirmLabel={t("giveBackDialog.confirm")}
        cancelLabel={t("giveBackDialog.keep")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void giveBack()}
      />
    </li>
  );
}
