"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import {
  branchFormSchema,
  DAYS,
  EMPTY_BRANCH_FORM,
  formValuesOf,
  mapLink,
  parseCoordinate,
  type AdminBranch,
  type BranchFormValues,
  type DayName,
} from "@/lib/admin-branches";
import { createBranch, updateBranch } from "@/lib/admin-branch-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { TURKISH_CITIES } from "@/lib/turkish-cities";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

type Props = { mode: "create" } | { mode: "edit"; row: AdminBranch };

// The fields that have a sentence of their own when the API refuses them.
const FIELD_ERRORS: readonly string[] = ["name", "city", "address", "latitude", "longitude", "phone", "email"];

// The form that makes a branch or changes one (V2-27, ADMIN.md §3.1). The rules are checked here for comfort and again by the
// action and the API (ADR-26); the API's own refusals (a version that moved on) are shown with the form. The position is two
// number fields with a link to look at the point on a map; a map to click on needs a key that is not here yet.
export function BranchForm(props: Props) {
  const t = useTranslations("Admin.branches");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const row = props.mode === "edit" ? props.row : null;
  const initial: BranchFormValues = row ? formValuesOf(row) : EMPTY_BRANCH_FORM;
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(
      branchFormSchema({
        name: t("errors.name"),
        city: t("errors.city"),
        address: t("errors.address"),
        latitude: t("errors.latitude"),
        longitude: t("errors.longitude"),
        phone: t("errors.phone"),
        email: t("errors.email"),
        hours: t("errors.hours"),
      }),
    ),
    defaultValues: initial,
  });

  const latitude = parseCoordinate(useWatch({ control, name: "latitude" }) ?? "");
  const longitude = parseCoordinate(useWatch({ control, name: "longitude" }) ?? "");

  async function onSubmit(values: BranchFormValues) {
    setFormError(null);
    setStale(false);
    const result = row ? await updateBranch(row.id, row.updatedAt, values, initial) : await createBranch(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(row ? t("toast.saved") : t("toast.created"));
        if (row) router.refresh();
        else router.push("/yonetim/bayiler");
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if (field in initial) {
            setError(field as keyof BranchFormValues, { message: t(`errors.${FIELD_ERRORS.includes(field) ? field : "generic"}` as "errors.name") });
            shown = true;
          }
          if (field === "openingHours") {
            for (const day of DAYS) setError(day, { message: t("errors.hours") });
            shown = true;
          }
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
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

      <Field label={t("fields.name")} error={errors.name?.message}>
        {(controlProps) => <Input autoComplete="off" maxLength={80} {...controlProps} {...register("name")} />}
      </Field>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.city")} error={errors.city?.message}>
          {(controlProps) => (
            <Select {...controlProps} {...register("city")}>
              <option value="">{t("fields.cityChoose")}</option>
              {TURKISH_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("fields.kind")} hint={t("fields.kindHint")}>
          {(controlProps) => (
            <Select {...controlProps} {...register("kind")}>
              <option value="CITY">{t("kind.CITY")}</option>
              <option value="AIRPORT">{t("kind.AIRPORT")}</option>
            </Select>
          )}
        </Field>
      </div>

      <Field label={t("fields.address")} error={errors.address?.message}>
        {(controlProps) => <Input autoComplete="off" maxLength={200} {...controlProps} {...register("address")} />}
      </Field>

      <div className="flex flex-col gap-3">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label={t("fields.latitude")} hint={t("fields.latitudeHint")} error={errors.latitude?.message}>
            {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("latitude")} />}
          </Field>
          <Field label={t("fields.longitude")} hint={t("fields.longitudeHint")} error={errors.longitude?.message}>
            {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("longitude")} />}
          </Field>
        </div>
        {latitude !== null && longitude !== null && (
          <a href={mapLink(latitude, longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center self-start text-link underline underline-offset-4">
            {t("fields.seeOnMap")}
          </a>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.phone")} error={errors.phone?.message}>
          {(controlProps) => <Input type="tel" autoComplete="off" maxLength={30} {...controlProps} {...register("phone")} />}
        </Field>
        <Field label={t("fields.email")} error={errors.email?.message}>
          {(controlProps) => <Input type="email" autoComplete="off" maxLength={120} {...controlProps} {...register("email")} />}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-label text-fg">{t("hours.title")}</legend>
        <p className="text-small text-fg-muted">{t("hours.hint")}</p>
        {DAYS.map((day) => (
          <DayRow key={day} day={day} register={register} control={control} error={(errors as FieldErrors<BranchFormValues>)[day]?.message} />
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : row ? t("form.save") : t("form.create")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/yonetim/bayiler">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

// One day: a switch for closed, and the two times. The times are real time inputs, so the keyboard and a phone's picker both
// work; they are switched off (not hidden) while the day is closed, and keep what they had if the day is opened again.
function DayRow({ day, register, control, error }: { day: DayName; register: UseFormRegister<BranchFormValues>; control: Control<BranchFormValues>; error?: string }) {
  const t = useTranslations("Admin.branches");
  const closed = useWatch({ control, name: `${day}.closed` });
  return (
    <div role="group" aria-label={t(`hours.${day}`)} className="flex flex-col gap-2 rounded-card border border-border p-4">
      <p className="text-label text-fg">{t(`hours.${day}`)}</p>
      <Checkbox {...register(`${day}.closed`)}>{t("hours.closed")}</Checkbox>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("hours.open")} error={error}>
          {(controlProps) => <Input type="time" disabled={closed} {...controlProps} {...register(`${day}.open`)} />}
        </Field>
        <Field label={t("hours.close")}>
          {(controlProps) => <Input type="time" disabled={closed} {...controlProps} {...register(`${day}.close`)} />}
        </Field>
      </div>
    </div>
  );
}
