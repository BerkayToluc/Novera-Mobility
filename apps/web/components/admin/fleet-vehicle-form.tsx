"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { addFleetVehicle } from "@/lib/admin-contract-actions";
import { EMPTY_VEHICLE_FORM, vehicleFormSchema, type VehicleFormValues } from "@/lib/admin-contracts";
import type { ModelOption } from "@/lib/admin-vehicles";
import { rateLimitMessage } from "@/lib/rate-limit";
import { useToast } from "./toast";

const FIELDS = ["modelSlug", "plate", "year", "startKm", "nextMaintenanceOn", "inspectionDueOn"] as const;

// Adding a car to a contract (V2-35, ADMIN.md §3.12). The plate is typed any way and kept in one form; it is one car, rented or in a
// fleet (a plate that is in use is refused with the reason). The car belongs to the contract's company.
export function FleetVehicleForm({ contractNumber, models }: { contractNumber: string; models: ModelOption[] }) {
  const t = useTranslations("Admin.contracts");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(
      vehicleFormSchema({
        modelSlug: t("errors.modelSlug"),
        plate: t("errors.plate"),
        year: t("errors.year"),
        startKm: t("errors.startKm"),
        nextMaintenanceOn: t("errors.day"),
        inspectionDueOn: t("errors.day"),
      }),
    ),
    defaultValues: EMPTY_VEHICLE_FORM,
  });

  async function onSubmit(values: VehicleFormValues) {
    setFormError(null);
    const result = await addFleetVehicle(contractNumber, values);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.vehicleAdded"));
        reset(EMPTY_VEHICLE_FORM);
        router.refresh();
        return;
      case "taken":
        setError("plate", { message: t("errors.plateTaken") });
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if (!(FIELDS as readonly string[]).includes(field)) continue;
          setError(field as keyof VehicleFormValues, { message: t(field === "nextMaintenanceOn" || field === "inspectionDueOn" ? "errors.day" : (`errors.${field}` as "errors.plate")) });
          shown = true;
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "not_allowed":
        setFormError(t("errors.contractEnded"));
        return;
      case "not_found":
        setFormError(t("errors.contractNotFound"));
        return;
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setFormError(t("errors.unavailable"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="vehicle-form-title" className="flex flex-col gap-4 rounded-card border border-border p-4">
      <h3 id="vehicle-form-title" className="text-label text-fg">
        {t("vehicleForm.title")}
      </h3>
      <p className="text-small text-fg-muted">{t("vehicleForm.hint")}</p>
      <FormError message={formError} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("vehicleForm.model")} error={errors.modelSlug?.message}>
          {(controlProps) => (
            <Select {...controlProps} {...register("modelSlug")}>
              <option value="">{t("vehicleForm.modelChoose")}</option>
              {models.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {model.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("vehicleForm.plate")} hint={t("vehicleForm.plateHint")} error={errors.plate?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={30} {...controlProps} {...register("plate")} />}
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("vehicleForm.year")} error={errors.year?.message}>
          {(controlProps) => <Input inputMode="numeric" autoComplete="off" maxLength={4} {...controlProps} {...register("year")} />}
        </Field>
        <Field label={t("vehicleForm.startKm")} error={errors.startKm?.message}>
          {(controlProps) => <Input inputMode="numeric" autoComplete="off" {...controlProps} {...register("startKm")} />}
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("vehicleForm.maintenance")} error={errors.nextMaintenanceOn?.message}>
          {(controlProps) => <Input type="date" {...controlProps} {...register("nextMaintenanceOn")} />}
        </Field>
        <Field label={t("vehicleForm.inspection")} error={errors.inspectionDueOn?.message}>
          {(controlProps) => <Input type="date" {...controlProps} {...register("inspectionDueOn")} />}
        </Field>
      </div>
      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("vehicleForm.adding") : t("vehicleForm.add")}
      </Button>
    </form>
  );
}
