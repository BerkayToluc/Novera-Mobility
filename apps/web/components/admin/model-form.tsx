"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import {
  consumptionUnitOf,
  EMPTY_MODEL_FORM,
  formValuesOf,
  FUEL_TYPES,
  modelFormSchema,
  suggestSlug,
  TRANSMISSIONS,
  type AdminModel,
  type ModelClass,
  type ModelFormValues,
} from "@/lib/admin-models";
import { createModel, updateModel } from "@/lib/admin-model-actions";
import { uploadVehicleImage } from "@/lib/admin-upload-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { FileField } from "./file-field";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

type Props = { classes: ModelClass[] } & ({ mode: "create" } | { mode: "edit"; row: AdminModel });

// The fields that have a sentence of their own when the API refuses them.
const FIELD_ERRORS: readonly string[] = ["brand", "model", "slug", "classSlug", "seats", "bags", "consumption", "dailyPrice", "descriptionTr", "descriptionEn"];

// The form that makes a model or changes one (V2-29, ADMIN.md §3.1). The rules are checked here for comfort and again by the
// action and the API (ADR-26); the API's own refusals (a version that moved on, an address already taken) are shown with the
// form. The address is made from the name and cannot be changed afterwards, since the site's links use it.
export function ModelForm(props: Props) {
  const t = useTranslations("Admin.models");
  const limitT = useTranslations("RateLimit");
  const locale = useLocale() as "tr" | "en";
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const row = props.mode === "edit" ? props.row : null;
  const initial: ModelFormValues = row ? formValuesOf(row) : EMPTY_MODEL_FORM;
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ModelFormValues>({
    resolver: zodResolver(
      modelFormSchema({
        brand: t("errors.brand"),
        model: t("errors.model"),
        slug: t("errors.slug"),
        classSlug: t("errors.classSlug"),
        seats: t("errors.seats"),
        bags: t("errors.bags"),
        consumption: t("errors.consumption"),
        dailyPrice: t("errors.dailyPrice"),
        descriptionTr: t("errors.descriptionTr"),
        descriptionEn: t("errors.descriptionEn"),
      }),
    ),
    defaultValues: initial,
  });

  const fuel = useWatch({ control, name: "fuelType" });
  const brand = useWatch({ control, name: "brand" }) ?? "";
  const modelName = useWatch({ control, name: "model" }) ?? "";
  const imageUrl = useWatch({ control, name: "imageUrl" }) ?? "";
  const suggested = suggestSlug(brand, modelName);

  async function onSubmit(values: ModelFormValues) {
    setFormError(null);
    setStale(false);
    const result = row ? await updateModel(row.slug, row.updatedAt, values, initial) : await createModel(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(row ? t("toast.saved") : t("toast.created"));
        if (row) router.refresh();
        else router.push("/yonetim/modeller");
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          const name = field === "description" ? "descriptionTr" : field;
          if (name in initial) {
            setError(name as keyof ModelFormValues, { message: t(`errors.${FIELD_ERRORS.includes(name) ? name : "generic"}` as "errors.brand") });
            shown = true;
          }
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "taken":
        setError("slug", { message: t("errors.slugTaken") });
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

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.brand")} error={errors.brand?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={40} {...controlProps} {...register("brand")} />}
        </Field>
        <Field label={t("fields.model")} error={errors.model?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("model")} />}
        </Field>
      </div>

      {row ? (
        <p className="text-small text-fg-muted">{t("fields.slugFixed", { slug: row.slug })}</p>
      ) : (
        <Field label={t("fields.slug")} hint={t("fields.slugHint", { slug: suggested || "…" })} error={errors.slug?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} placeholder={suggested} {...controlProps} {...register("slug")} />}
        </Field>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.class")} error={errors.classSlug?.message}>
          {(controlProps) => (
            <Select {...controlProps} {...register("classSlug")}>
              <option value="">{t("fields.classChoose")}</option>
              {props.classes.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.name[locale]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("fields.transmission")}>
          {(controlProps) => (
            <Select {...controlProps} {...register("transmission")}>
              {TRANSMISSIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`transmission.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.fuel")}>
          {(controlProps) => (
            <Select {...controlProps} {...register("fuelType")}>
              {FUEL_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`fuel.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t(`fields.consumption.${consumptionUnitOf(fuel)}`)} hint={t("fields.consumptionHint")} error={errors.consumption?.message}>
          {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("consumption")} />}
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Field label={t("fields.seats")} error={errors.seats?.message}>
          {(controlProps) => <Input inputMode="numeric" autoComplete="off" {...controlProps} {...register("seats")} />}
        </Field>
        <Field label={t("fields.bags")} error={errors.bags?.message}>
          {(controlProps) => <Input inputMode="numeric" autoComplete="off" {...controlProps} {...register("bags")} />}
        </Field>
        <Field label={t("fields.dailyPrice")} hint={t("fields.dailyPriceHint")} error={errors.dailyPrice?.message}>
          {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("dailyPrice")} />}
        </Field>
      </div>

      <Field label={t("fields.descriptionTr")} error={errors.descriptionTr?.message}>
        {(controlProps) => <Textarea rows={4} maxLength={1000} {...controlProps} {...register("descriptionTr")} />}
      </Field>
      <Field label={t("fields.descriptionEn")} error={errors.descriptionEn?.message}>
        {(controlProps) => <Textarea rows={4} maxLength={1000} {...controlProps} {...register("descriptionEn")} />}
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-label text-fg">{t("photo.title")}</legend>
        <p className="text-small text-fg-muted">{t("photo.hint")}</p>
        {imageUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <Image src={imageUrl} alt={t("photo.currentAlt", { name: `${brand} ${modelName}`.trim() })} width={160} height={100} unoptimized className="aspect-16/10 w-40 rounded-media object-cover" />
            <Button type="button" variant="outline" onClick={() => setValue("imageUrl", "", { shouldDirty: true })}>
              {t("photo.remove")}
            </Button>
          </div>
        ) : (
          <p className="text-small text-fg-muted">{t("photo.none")}</p>
        )}
        <FileField
          label={t("photo.choose")}
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          typesLabel="JPEG, PNG, WebP"
          maxSizeMb={5}
          upload={uploadVehicleImage}
          onUploaded={(url) => setValue("imageUrl", url ?? initial.imageUrl, { shouldDirty: true })}
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : row ? t("form.save") : t("form.create")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/yonetim/modeller">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
