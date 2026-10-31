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
import { createExpense } from "@/lib/expense-actions";
import { EMPTY_EXPENSE_FORM, EXPENSE_TYPES, expenseFormSchema, type ExpenseFormValues } from "@/lib/expenses";
import { rateLimitMessage } from "@/lib/rate-limit";
import { useToast } from "./toast";

const FIELDS = ["plate", "type", "occurredAt", "amount", "description", "place"] as const;

// The form that enters an expense by the plate of the car (V2-38, ADMIN.md §3.16). The rules are checked here for comfort and again by the
// action and the API (ADR-26). The amount is typed in lira and sent in kuruş; the time is Istanbul time and cannot be in the future.
export function ExpenseForm() {
  const t = useTranslations("Admin.fleetExpenses");
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
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(
      expenseFormSchema({ plate: t("errors.plate"), type: t("errors.type"), occurredAt: t("errors.occurredAt"), amount: t("errors.amount"), description: t("errors.description"), place: t("errors.place") }),
    ),
    defaultValues: EMPTY_EXPENSE_FORM,
  });

  async function onSubmit(values: ExpenseFormValues) {
    setFormError(null);
    const result = await createExpense(values);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.created"));
        reset(EMPTY_EXPENSE_FORM);
        router.refresh();
        return;
      case "invalid": {
        let shown = false;
        for (const [field, code] of Object.entries(result.fields)) {
          if (!(FIELDS as readonly string[]).includes(field)) continue;
          const message =
            field === "plate" && code === "UNKNOWN_REFERENCE" ? t("errors.plateUnknown") : field === "occurredAt" && code === "OUT_OF_RANGE" ? t("errors.occurredAtFuture") : t(`errors.${field}` as "errors.plate");
          setError(field as keyof ExpenseFormValues, { message });
          shown = true;
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setFormError(t("errors.unavailable"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={t("form.label")} className="flex max-w-3xl flex-col gap-5 rounded-card border border-border p-4">
      <h2 className="text-label text-fg">{t("form.title")}</h2>
      <p className="text-small text-fg-muted">{t("form.text")}</p>
      <FormError message={formError} />

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.plate")} hint={t("fields.plateHint")} error={errors.plate?.message}>
          {(controlProps) => <Input autoComplete="off" autoCapitalize="characters" {...controlProps} {...register("plate")} />}
        </Field>
        <Field label={t("fields.type")} error={errors.type?.message}>
          {(controlProps) => (
            <Select {...controlProps} {...register("type")}>
              {EXPENSE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.occurredAt")} hint={t("fields.occurredAtHint")} error={errors.occurredAt?.message}>
          {(controlProps) => <Input type="datetime-local" {...controlProps} {...register("occurredAt")} />}
        </Field>
        <Field label={t("fields.amount")} hint={t("fields.amountHint")} error={errors.amount?.message}>
          {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("amount")} />}
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.description")} error={errors.description?.message}>
          {(controlProps) => <Input autoComplete="off" {...controlProps} {...register("description")} />}
        </Field>
        <Field label={t("fields.place")} error={errors.place?.message}>
          {(controlProps) => <Input autoComplete="off" {...controlProps} {...register("place")} />}
        </Field>
      </div>

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}
