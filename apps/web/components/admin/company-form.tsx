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
import { createCompany, updateCompany } from "@/lib/admin-company-actions";
import { companyFormSchema, EMPTY_COMPANY_FORM, formValuesOf, type AdminCompanyDetail, type CompanyFormValues } from "@/lib/admin-companies";
import { rateLimitMessage } from "@/lib/rate-limit";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

type Props = { mode: "create" } | { mode: "edit"; row: AdminCompanyDetail };

const FIELDS = ["name", "taxOffice", "city", "phone", "salesName", "salesEmail", "salesPhone"] as const;

// The form that makes a company or changes one (V2-33, ADMIN.md §3.3). The rules are checked here for comfort and again by the
// action and the API (ADR-26); the API's own refusals (a name that is taken, a version that moved on) are shown with the form.
export function CompanyForm(props: Props) {
  const t = useTranslations("Admin.companies");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const row = props.mode === "edit" ? props.row : null;
  const initial: CompanyFormValues = row ? formValuesOf(row) : EMPTY_COMPANY_FORM;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(
      companyFormSchema({
        name: t("errors.name"),
        taxOffice: t("errors.taxOffice"),
        city: t("errors.city"),
        phone: t("errors.phone"),
        salesName: t("errors.salesName"),
        salesEmail: t("errors.salesEmail"),
        salesPhone: t("errors.salesPhone"),
      }),
    ),
    defaultValues: initial,
  });

  async function onSubmit(values: CompanyFormValues) {
    setFormError(null);
    setStale(false);
    const result = row ? await updateCompany(row.id, row.updatedAt, values, initial) : await createCompany(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(row ? t("toast.saved") : t("toast.created"));
        if (row) router.refresh();
        else router.push({ pathname: "/yonetim/sirketler/[id]", params: { id: result.id } });
        return;
      case "invalid": {
        let shown = false;
        for (const [field, code] of Object.entries(result.fields)) {
          if (!(FIELDS as readonly string[]).includes(field)) continue;
          setError(field as keyof CompanyFormValues, { message: field === "name" && code === "NAME_TAKEN" ? t("errors.nameTaken") : t(`errors.${field}` as "errors.name") });
          shown = true;
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
        {(controlProps) => <Input autoComplete="off" maxLength={120} {...controlProps} {...register("name")} />}
      </Field>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.taxOffice")} error={errors.taxOffice?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={80} {...controlProps} {...register("taxOffice")} />}
        </Field>
        <Field label={t("fields.city")} error={errors.city?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("city")} />}
        </Field>
      </div>

      <Field label={t("fields.phone")} error={errors.phone?.message}>
        {(controlProps) => <Input type="tel" autoComplete="off" maxLength={30} {...controlProps} {...register("phone")} />}
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-label text-fg">{t("sales.title")}</legend>
        <p className="text-small text-fg-muted">{t("sales.hint")}</p>
        <Field label={t("fields.salesName")} error={errors.salesName?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={80} {...controlProps} {...register("salesName")} />}
        </Field>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label={t("fields.salesEmail")} error={errors.salesEmail?.message}>
            {(controlProps) => <Input type="email" autoComplete="off" maxLength={120} {...controlProps} {...register("salesEmail")} />}
          </Field>
          <Field label={t("fields.salesPhone")} error={errors.salesPhone?.message}>
            {(controlProps) => <Input type="tel" autoComplete="off" maxLength={30} {...controlProps} {...register("salesPhone")} />}
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : row ? t("form.save") : t("form.create")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/yonetim/sirketler">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
