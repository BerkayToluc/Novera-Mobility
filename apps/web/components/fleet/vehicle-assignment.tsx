"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/admin/toast";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { assignVehicle, endAssignment } from "@/lib/fleet-actions";
import { assignFormSchema, EMPTY_ASSIGN_FORM, type AssignFormValues, type FleetAssignment, type FleetEmployee, type FleetVehicleDetail } from "@/lib/fleet-panel";
import { rateLimitMessage } from "@/lib/rate-limit";

type Props = { vehicle: FleetVehicleDetail; open: FleetAssignment | null; employees: FleetEmployee[] };

// Giving a car to a person and taking it back (V2-36, docs/FLEET.md §3, §4.1). A car has at most one open assignment: while it has one the
// screen says who has it and offers to take it back (asked about, in a window); when it has none it offers the form to give it. The API's
// answer is the one that counts (a car given to someone at the same moment is refused with the reason).
export function VehicleAssignment({ vehicle, open, employees }: Props) {
  const t = useTranslations("FleetPanel.assignment");
  const limitT = useTranslations("RateLimit");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema({ employeeId: t("errors.employee"), startedAt: t("errors.startedAt"), note: t("errors.note") })),
    defaultValues: EMPTY_ASSIGN_FORM,
  });

  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Istanbul" });

  async function onSubmit(values: AssignFormValues) {
    setFormError(null);
    const result = await assignVehicle(vehicle.id, values);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.given"));
        reset(EMPTY_ASSIGN_FORM);
        router.refresh();
        return;
      case "assigned":
        setFormError(t("errors.assigned"));
        router.refresh();
        return;
      case "not_allowed":
        setFormError(t("errors.returned"));
        return;
      case "invalid": {
        let shown = false;
        for (const [field, code] of Object.entries(result.fields)) {
          if (field === "employeeId") setError("employeeId", { message: code === "NOT_ALLOWED" ? t("errors.inactive") : t("errors.employee") });
          else if (field === "startedAt") setError("startedAt", { message: t("errors.startedAt") });
          else if (field === "note") setError("note", { message: t("errors.note") });
          else continue;
          shown = true;
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "not_found":
        setFormError(t("errors.notFound"));
        return;
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setFormError(t("errors.unavailable"));
    }
  }

  async function takeBack() {
    if (!open) return;
    setPending(true);
    const result = await endAssignment(open.id);
    setPending(false);
    setAsking(false);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.taken"));
        router.refresh();
        return;
      case "not_allowed":
        toast.show(t("errors.alreadyEnded"), "error");
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

  return (
    <section aria-labelledby="vehicle-assignment" className="flex max-w-2xl flex-col gap-4">
      <h2 id="vehicle-assignment" className="text-h3 text-fg">
        {t("title")}
      </h2>

      {vehicle.status === "RETURNED" ? (
        <p className="text-body text-fg-muted">{t("returnedText")}</p>
      ) : open ? (
        <div className="flex flex-col gap-3 rounded-card border border-border p-4">
          <p className="text-body text-fg">{t("current", { name: open.employee.name, date: day.format(new Date(open.startedAt)) })}</p>
          {open.note && <p className="text-small text-fg-muted">{open.note}</p>}
          <Button type="button" variant="outline" className="self-start" disabled={pending} onClick={() => setAsking(true)}>
            {t("takeBack")}
          </Button>
        </div>
      ) : employees.length === 0 ? (
        <p className="rounded-card border border-border p-4 text-body text-fg-muted">
          {t("noEmployees")}{" "}
          <Link href="/filom/personel/yeni" className="text-link underline underline-offset-4">
            {t("addEmployee")}
          </Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="vehicle-assignment" className="flex flex-col gap-4 rounded-card border border-border p-4">
          <p className="text-body text-fg-muted">{t("idleText")}</p>
          <FormError message={formError} />
          <Field label={t("employee")} error={errors.employeeId?.message}>
            {(controlProps) => (
              <Select {...controlProps} {...register("employeeId")}>
                <option value="">{t("employeeChoose")}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {`${employee.firstName} ${employee.lastName}${employee.department ? ` · ${employee.department}` : ""}${employee.vehicle ? ` (${employee.vehicle.plate})` : ""}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("startedAt")} hint={t("startedAtHint")} error={errors.startedAt?.message}>
              {(controlProps) => <Input type="date" {...controlProps} {...register("startedAt")} />}
            </Field>
            <Field label={t("note")} error={errors.note?.message}>
              {(controlProps) => <Input autoComplete="off" maxLength={200} {...controlProps} {...register("note")} />}
            </Field>
          </div>
          <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? t("giving") : t("give")}
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={asking}
        title={t("takeBackDialog.title", { plate: vehicle.plate })}
        text={t("takeBackDialog.text", { name: open?.employee.name ?? "" })}
        confirmLabel={t("takeBackDialog.confirm")}
        cancelLabel={t("takeBackDialog.keep")}
        tone="primary"
        pending={pending}
        onCancel={() => setAsking(false)}
        onConfirm={() => void takeBack()}
      />
    </section>
  );
}
