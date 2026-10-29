"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { updateExtra } from "@/lib/admin-extra-actions";
import { extraFormSchema, formValuesOf, type AdminExtra, type ExtraFormValues } from "@/lib/admin-extras";
import { rateLimitMessage } from "@/lib/rate-limit";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

const FIELD_ERRORS: readonly string[] = ["nameTr", "nameEn", "price"];

// The form that changes the name and the price of an extra service (V2-30, ADMIN.md §3.1). The rules are checked here for
// comfort and again by the action and the API (ADR-26). Extras are fixed, so there is no way to add or remove one, and the way
// it is priced (per day or once) is shown but not changed. A new price is for the quotes and bookings made after it.
export function ExtraForm({ row }: { row: AdminExtra }) {
  const t = useTranslations("Admin.extras");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const initial: ExtraFormValues = formValuesOf(row);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ExtraFormValues>({
    resolver: zodResolver(extraFormSchema({ nameTr: t("errors.nameTr"), nameEn: t("errors.nameEn"), price: t("errors.price") })),
    defaultValues: initial,
  });

  async function onSubmit(values: ExtraFormValues) {
    setFormError(null);
    setStale(false);
    const result = await updateExtra(row.slug, row.updatedAt, values, initial);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(t("toast.saved"));
        router.push("/yonetim/ek-hizmetler");
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          const name = field === "name" ? "nameTr" : field;
          if (name in initial) {
            setError(name as keyof ExtraFormValues, { message: t(`errors.${FIELD_ERRORS.includes(name) ? name : "generic"}` as "errors.price") });
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

      <p className="text-small text-fg-muted">{t(`pricing.${row.pricing}`)}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.nameTr")} error={errors.nameTr?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={80} {...controlProps} {...register("nameTr")} />}
        </Field>
        <Field label={t("fields.nameEn")} error={errors.nameEn?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={80} {...controlProps} {...register("nameEn")} />}
        </Field>
      </div>

      <Field label={t(row.pricing === "PER_DAY" ? "fields.pricePerDay" : "fields.priceFixed")} hint={t("fields.priceHint")} error={errors.price?.message}>
        {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("price")} />}
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : t("form.save")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/yonetim/ek-hizmetler">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
