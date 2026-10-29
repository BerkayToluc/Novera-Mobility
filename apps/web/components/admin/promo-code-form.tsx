"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { EMPTY_PROMO_FORM, formValuesOf, promoFormSchema, type PromoCode, type PromoFormValues } from "@/lib/admin-promo";
import { createPromoCode, updatePromoCode } from "@/lib/admin-promo-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

type Props = { mode: "create" } | { mode: "edit"; row: PromoCode };

// The form that makes a campaign code or changes one (V2-26, ADMIN.md §3.1). The name of a code is chosen once and does not
// change, so on an existing code it is shown, not asked. The rules are checked here for comfort and again by the action and
// the API (ADR-26); the API's own refusals (a name that is taken, a cap below the uses so far, a version that moved on) are
// shown on the field they belong to.
export function PromoCodeForm(props: Props) {
  const t = useTranslations("Admin.promoCodes");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const row = props.mode === "edit" ? props.row : null;
  const initial: PromoFormValues = row ? formValuesOf(row) : EMPTY_PROMO_FORM;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PromoFormValues>({
    resolver: zodResolver(
      promoFormSchema({
        code: t("errors.code"),
        percent: t("errors.percent"),
        validFrom: t("errors.validFrom"),
        validUntil: t("errors.validUntil"),
        maxRedemptions: t("errors.maxRedemptions"),
      }),
    ),
    defaultValues: initial,
  });

  // What the API said about a field, in words. A code of its own gets its own sentence; any other is the field's general one.
  function fieldMessage(field: string, code: string): string {
    if (field === "validUntil" && code === "INVALID_DATE_RANGE") return t("errors.dateRange");
    if (field === "maxRedemptions" && code === "BELOW_USAGE") return t("errors.belowUsage", { used: row?.used ?? 0 });
    if (field === "code" && code === "CODE_TAKEN") return t("errors.taken");
    return t(`errors.${field === "code" || field === "percent" || field === "validFrom" || field === "validUntil" || field === "maxRedemptions" ? field : "generic"}`);
  }

  async function onSubmit(values: PromoFormValues) {
    setFormError(null);
    setStale(false);
    const result = row ? await updatePromoCode(row.code, row.updatedAt, values, initial) : await createPromoCode(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(row ? t("toast.saved") : t("toast.created"));
        if (row) router.refresh();
        else router.push("/yonetim/kampanya-kodlari");
        return;
      case "invalid":
        for (const [field, code] of Object.entries(result.fields)) {
          if (field in initial) setError(field as keyof PromoFormValues, { message: fieldMessage(field, code) });
        }
        setFormError(Object.keys(result.fields).some((field) => field in initial) ? null : t("errors.generic"));
        return;
      case "taken":
        setError("code", { message: t("errors.taken") });
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

      {row ? (
        <div className="flex flex-col gap-1">
          <p className="text-label text-fg">{t("fields.code")}</p>
          <p className="text-h3 text-fg">{row.code}</p>
          <p className="text-small text-fg-muted">{t("fields.codeFixed")}</p>
        </div>
      ) : (
        <Field label={t("fields.code")} hint={t("fields.codeHint")} error={errors.code?.message}>
          {(props) => <Input autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} {...props} {...register("code")} />}
        </Field>
      )}

      <Field label={t("fields.percent")} hint={t("fields.percentHint")} error={errors.percent?.message}>
        {(props) => <Input inputMode="numeric" autoComplete="off" maxLength={2} className="max-w-32" {...props} {...register("percent")} />}
      </Field>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.validFrom")} hint={t("fields.validFromHint")} error={errors.validFrom?.message}>
          {(props) => <Input type="date" {...props} {...register("validFrom")} />}
        </Field>
        <Field label={t("fields.validUntil")} hint={t("fields.validUntilHint")} error={errors.validUntil?.message}>
          {(props) => <Input type="date" {...props} {...register("validUntil")} />}
        </Field>
      </div>

      <Field
        label={t("fields.maxRedemptions")}
        hint={row ? t("fields.maxRedemptionsHintUsed", { used: row.used }) : t("fields.maxRedemptionsHint")}
        error={errors.maxRedemptions?.message}
      >
        {(props) => <Input inputMode="numeric" autoComplete="off" maxLength={7} className="max-w-48" {...props} {...register("maxRedemptions")} />}
      </Field>

      <div className="flex flex-col">
        <Checkbox {...register("oncePerUser")}>{t("fields.oncePerUser")}</Checkbox>
        <Checkbox {...register("active")}>{t("fields.active")}</Checkbox>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : row ? t("form.save") : t("form.create")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/yonetim/kampanya-kodlari">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
