"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StaleWriteBanner } from "@/components/admin/stale-write-banner";
import { useToast } from "@/components/admin/toast";
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { createEmployee, updateEmployee } from "@/lib/fleet-actions";
import { EMPTY_EMPLOYEE_FORM, employeeFormSchema, employeeFormValuesOf, type EmployeeFormValues, type FleetEmployee } from "@/lib/fleet-panel";
import { rateLimitMessage } from "@/lib/rate-limit";

type Props = { mode: "create" } | { mode: "edit"; employee: FleetEmployee };

const FIELDS = ["firstName", "lastName", "department", "employeeNo", "email", "phone"] as const;

// The form that adds a person of the company or changes one (V2-36, docs/FLEET.md §3). The rules are checked here for comfort and again by
// the action and the API (ADR-26). Nobody is deleted; a person who leaves is made inactive on their own page. No licence data is asked
// for or kept (FLEET.md §6).
export function EmployeeForm(props: Props) {
  const t = useTranslations("FleetPanel.employeeForm");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const employee = props.mode === "edit" ? props.employee : null;
  const initial: EmployeeFormValues = employee ? employeeFormValuesOf(employee) : EMPTY_EMPLOYEE_FORM;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(
      employeeFormSchema({
        firstName: t("errors.firstName"),
        lastName: t("errors.lastName"),
        department: t("errors.department"),
        employeeNo: t("errors.employeeNo"),
        email: t("errors.email"),
        phone: t("errors.phone"),
      }),
    ),
    defaultValues: initial,
  });

  async function onSubmit(values: EmployeeFormValues) {
    setFormError(null);
    setStale(false);
    const result = employee ? await updateEmployee(employee.id, employee.updatedAt, values, initial) : await createEmployee(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(employee ? t("toast.saved") : t("toast.created"));
        if (employee) router.refresh();
        else router.push("/filom/personel");
        return;
      case "no_taken":
        setError("employeeNo", { message: t("errors.employeeNoTaken") });
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if (!(FIELDS as readonly string[]).includes(field)) continue;
          setError(field as keyof EmployeeFormValues, { message: t(`errors.${field}` as "errors.firstName") });
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={employee ? t("editLabel") : t("newLabel")} className="flex max-w-2xl flex-col gap-6">
      <UnsavedChangesGuard dirty={isDirty && !done} />
      <FormError message={formError} />
      {stale && <StaleWriteBanner onReload={() => router.refresh()} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.firstName")} error={errors.firstName?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("firstName")} />}
        </Field>
        <Field label={t("fields.lastName")} error={errors.lastName?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("lastName")} />}
        </Field>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.department")} error={errors.department?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("department")} />}
        </Field>
        <Field label={t("fields.employeeNo")} hint={t("fields.employeeNoHint")} error={errors.employeeNo?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={30} {...controlProps} {...register("employeeNo")} />}
        </Field>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t("fields.email")} error={errors.email?.message}>
          {(controlProps) => <Input type="email" autoComplete="off" maxLength={120} {...controlProps} {...register("email")} />}
        </Field>
        <Field label={t("fields.phone")} error={errors.phone?.message}>
          {(controlProps) => <Input type="tel" autoComplete="off" maxLength={30} {...controlProps} {...register("phone")} />}
        </Field>
      </div>
      <p className="text-small text-fg-muted">{t("privacy")}</p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t("form.saving") : employee ? t("form.save") : t("form.create")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/filom/personel">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
