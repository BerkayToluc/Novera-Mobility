"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { addReading } from "@/lib/admin-contract-actions";
import { EMPTY_READING_FORM, readingFormSchema, type FleetVehicle, type ReadingFormValues } from "@/lib/admin-contracts";
import { rateLimitMessage } from "@/lib/rate-limit";
import { useToast } from "./toast";

type Values = ReadingFormValues & { vehicleId: string };
const FIELDS = ["km", "fuelPercent", "chargePercent", "batteryHealthPercent"] as const;

// Entering a reading for a car (V2-35, ADMIN.md §3.12): the kilometre, and the fuel, charge and battery health where they apply. The
// kilometre does not go back; the API says so, and the form shows it on the field. Only cars still in use are offered.
export function ReadingForm({ vehicles }: { vehicles: FleetVehicle[] }) {
  const t = useTranslations("Admin.contracts");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const active = vehicles.filter((vehicle) => vehicle.status === "ACTIVE");
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(
      readingFormSchema({ km: t("errors.km"), fuelPercent: t("errors.percent"), chargePercent: t("errors.percent"), batteryHealthPercent: t("errors.percent") }).extend({ vehicleId: z.string().min(1, t("errors.vehicle")) }),
    ),
    defaultValues: { ...EMPTY_READING_FORM, vehicleId: active[0]?.id ?? "" },
  });
  const chosenId = useWatch({ control, name: "vehicleId" });
  const chosen = active.find((vehicle) => vehicle.id === chosenId);

  async function onSubmit({ vehicleId, ...values }: Values) {
    setFormError(null);
    const result = await addReading(vehicleId, values);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.readingAdded"));
        reset({ ...EMPTY_READING_FORM, vehicleId });
        router.refresh();
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if (!(FIELDS as readonly string[]).includes(field)) continue;
          setError(field as keyof ReadingFormValues, { message: field === "km" ? t("errors.kmBack", { km: chosen?.lastKm ?? 0 }) : t("errors.percent") });
          shown = true;
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "not_allowed":
        setFormError(t("errors.vehicleChanged"));
        router.refresh();
        return;
      case "not_found":
        setFormError(t("errors.vehicleNotFound"));
        return;
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setFormError(t("errors.unavailable"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="reading-form-title" className="flex flex-col gap-4 rounded-card border border-border p-4">
      <h3 id="reading-form-title" className="text-label text-fg">
        {t("readingForm.title")}
      </h3>
      <p className="text-small text-fg-muted">{t("readingForm.hint")}</p>
      {active.length === 0 ? (
        <p className="text-body text-fg-muted">{t("readingForm.noVehicles")}</p>
      ) : (
        <>
          <FormError message={formError} />
          <Field label={t("readingForm.vehicle")} error={errors.vehicleId?.message}>
            {(controlProps) => (
              <Select {...controlProps} {...register("vehicleId")}>
                {active.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {`${vehicle.plate} · ${vehicle.model.brand} ${vehicle.model.model}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("readingForm.km")} hint={chosen ? t("readingForm.kmHint", { km: chosen.lastKm }) : undefined} error={errors.km?.message}>
            {(controlProps) => <Input inputMode="numeric" autoComplete="off" {...controlProps} {...register("km")} />}
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("readingForm.fuel")} error={errors.fuelPercent?.message}>
              {(controlProps) => <Input inputMode="numeric" autoComplete="off" maxLength={3} {...controlProps} {...register("fuelPercent")} />}
            </Field>
            <Field label={t("readingForm.charge")} error={errors.chargePercent?.message}>
              {(controlProps) => <Input inputMode="numeric" autoComplete="off" maxLength={3} {...controlProps} {...register("chargePercent")} />}
            </Field>
            <Field label={t("readingForm.battery")} error={errors.batteryHealthPercent?.message}>
              {(controlProps) => <Input inputMode="numeric" autoComplete="off" maxLength={3} {...controlProps} {...register("batteryHealthPercent")} />}
            </Field>
          </div>
          <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? t("readingForm.saving") : t("readingForm.save")}
          </Button>
        </>
      )}
    </form>
  );
}
