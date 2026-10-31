"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/admin/toast";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { setEmployeeActive } from "@/lib/fleet-actions";
import type { FleetEmployee } from "@/lib/fleet-panel";
import { rateLimitMessage } from "@/lib/rate-limit";

// Making a person inactive and active again (V2-36, docs/FLEET.md §3). Nobody is deleted. Making a person inactive is asked about: the
// car they have comes back at once (the assignment ends in the same step) and they cannot be given another; opening them again is one press.
export function EmployeeActions({ employee }: { employee: FleetEmployee }) {
  const t = useTranslations("FleetPanel.employeeActions");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function change(active: boolean) {
    setPending(true);
    const result = await setEmployeeActive(employee.id, employee.updatedAt, active);
    setPending(false);
    setAsking(false);
    switch (result.status) {
      case "ok":
        toast.show(active ? t("toast.activated") : t("toast.deactivated"));
        router.refresh();
        return;
      case "stale":
        toast.show(t("errors.stale"), "error");
        router.refresh();
        return;
      case "rate_limited":
        toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
        return;
      case "not_found":
        toast.show(t("errors.notFound"), "error");
        return;
      default:
        toast.show(t("errors.unavailable"), "error");
    }
  }

  const name = `${employee.firstName} ${employee.lastName}`;
  return (
    <section aria-labelledby="employee-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="employee-actions" className="text-h3 text-fg">
        {t("title")}
      </h2>
      {employee.active ? (
        <>
          <p className="text-body text-fg-muted">{employee.vehicle ? t("activeWithCar", { plate: employee.vehicle.plate }) : t("activeText")}</p>
          <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => setAsking(true)}>
            {t("deactivate")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-fg-muted">{t("inactiveText")}</p>
          <Button type="button" className="self-start" disabled={pending} onClick={() => void change(true)}>
            {t("activate")}
          </Button>
        </>
      )}
      <ConfirmDialog
        open={asking}
        title={t("dialog.title", { name })}
        text={employee.vehicle ? t("dialog.textWithCar", { plate: employee.vehicle.plate }) : t("dialog.text")}
        confirmLabel={t("dialog.confirm")}
        cancelLabel={t("dialog.keep")}
        pending={pending}
        onCancel={() => setAsking(false)}
        onConfirm={() => void change(false)}
      />
    </section>
  );
}
