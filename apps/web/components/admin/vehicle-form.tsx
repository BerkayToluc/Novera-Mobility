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
import { StateMessage } from "@/components/ui/state-message";
import { Link, useRouter } from "@/i18n/navigation";
import { createVehicle, moveVehicle } from "@/lib/admin-vehicle-actions";
import {
  EMPTY_VEHICLE_FORM,
  formValuesOf,
  vehicleFormSchema,
  type AdminVehicle,
  type BranchOption,
  type ModelOption,
  type VehicleFormValues,
  type VehicleUsage,
} from "@/lib/admin-vehicles";
import { rateLimitMessage } from "@/lib/rate-limit";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

type Props = { models: ModelOption[]; branches: BranchOption[] } & ({ mode: "create" } | { mode: "edit"; row: AdminVehicle });

// The fields that have a sentence of their own when the API refuses them.
const FIELD_ERRORS: readonly string[] = ["plate", "year", "modelSlug", "branchId"];

// The form that adds a car, or moves one to another branch (V2-30, ADMIN.md §3.1). The rules are checked here for comfort and
// again by the action and the API (ADR-26); the API's own refusals (a plate that is taken, a version that moved on, a car that
// is still booked) are shown with the form. The plate, the year and the model of a car never change: a wrong one is switched
// off and a new car added, so that what a booking says about its car stays true.
export function VehicleForm(props: Props) {
  const t = useTranslations("Admin.vehicles");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);
  const [refusal, setRefusal] = useState<VehicleUsage | null>(null);

  const row = props.mode === "edit" ? props.row : null;
  const initial: VehicleFormValues = row ? formValuesOf(row) : EMPTY_VEHICLE_FORM;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(
      vehicleFormSchema({
        plate: t("errors.plate"),
        year: t("errors.year", { min: 2015, max: new Date().getFullYear() + 1 }),
        modelSlug: t("errors.modelSlug"),
        branchId: t("errors.branchId"),
      }),
    ),
    defaultValues: initial,
  });

  // The car's own branch is in the choice even when it is closed (it is where the car is), so the box shows the truth.
  const branchChoices = row && !props.branches.some((branch) => branch.id === row.branch.id) ? [{ id: row.branch.id, label: `${row.branch.name} (${t("closedBranch")})` }, ...props.branches] : props.branches;

  async function onSubmit(values: VehicleFormValues) {
    setFormError(null);
    setStale(false);
    setRefusal(null);
    const result = row ? await moveVehicle(row.id, row.updatedAt, values.branchId) : await createVehicle(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(row ? t("toast.moved") : t("toast.created"));
        if (row) router.refresh();
        else router.push("/yonetim/araclar");
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if (field in initial) {
            const message =
              result.fields[field] === "UNKNOWN_REFERENCE" && (field === "branchId" || field === "modelSlug")
                ? t(`errors.${field}Unavailable`)
                : t(`errors.${FIELD_ERRORS.includes(field) ? field : "generic"}` as "errors.plate", { min: 2015, max: new Date().getFullYear() + 1 });
            setError(field as keyof VehicleFormValues, { message });
            shown = true;
          }
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "taken":
        setError("plate", { message: t("errors.plateTaken") });
        return;
      case "in_use":
        setRefusal(result.usage);
        return;
      case "stale":
        setStale(true);
        return;
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-2xl flex-col gap-6">
      <UnsavedChangesGuard dirty={isDirty && !done} />
      <FormError message={formError} />
      {stale && <StaleWriteBanner onReload={() => router.refresh()} />}
      {refusal && (
        <StateMessage tone="error" title={t("move.blockedTitle")} text={t("move.blockedText")}>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-fg">
            {refusal.reservations > 0 && <li>{t("usage.reservations", { count: refusal.reservations })}</li>}
            {refusal.holds > 0 && <li>{t("usage.holds", { count: refusal.holds })}</li>}
          </ul>
        </StateMessage>
      )}

      {row ? (
        <div className="flex flex-col gap-3 rounded-card border border-border p-4">
          <dl className="grid gap-4 md:grid-cols-3">
            <div>
              <dt className="text-small text-fg-muted">{t("fields.plate")}</dt>
              <dd className="text-body text-fg">{row.plate}</dd>
            </div>
            <div>
              <dt className="text-small text-fg-muted">{t("fields.year")}</dt>
              <dd className="text-body text-fg">{row.year}</dd>
            </div>
            <div>
              <dt className="text-small text-fg-muted">{t("fields.model")}</dt>
              <dd className="text-body text-fg">{`${row.model.brand} ${row.model.model}`}</dd>
            </div>
          </dl>
          <p className="text-small text-fg-muted">{t("fields.fixedHint")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label={t("fields.plate")} hint={t("fields.plateHint")} error={errors.plate?.message}>
              {(controlProps) => <Input autoComplete="off" autoCapitalize="characters" maxLength={30} {...controlProps} {...register("plate")} />}
            </Field>
            <Field label={t("fields.year")} error={errors.year?.message}>
              {(controlProps) => <Input inputMode="numeric" autoComplete="off" maxLength={4} {...controlProps} {...register("year")} />}
            </Field>
          </div>
          <Field label={t("fields.model")} hint={t("fields.modelHint")} error={errors.modelSlug?.message}>
            {(controlProps) => (
              <Select {...controlProps} {...register("modelSlug")}>
                <option value="">{t("fields.modelChoose")}</option>
                {props.models.map((model) => (
                  <option key={model.slug} value={model.slug}>
                    {model.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}

      <Field label={t(row ? "fields.branchMove" : "fields.branch")} hint={row ? t("fields.branchMoveHint") : undefined} error={errors.branchId?.message}>
        {(controlProps) => (
          <Select {...controlProps} {...register("branchId")}>
            {!row && <option value="">{t("fields.branchChoose")}</option>}
            {branchChoices.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting || (row !== null && !isDirty)} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : row ? t("form.move") : t("form.create")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/yonetim/araclar">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
