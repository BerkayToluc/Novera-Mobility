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
import { createContract, updateContract } from "@/lib/admin-contract-actions";
import { contractFormSchema, contractFormValuesOf, CONTRACT_PRODUCTS, EMPTY_CONTRACT_FORM, type ContractFormValues, type FleetContract } from "@/lib/admin-contracts";
import { rateLimitMessage } from "@/lib/rate-limit";
import { TURKISH_CITIES } from "@/lib/turkish-cities";
import { StaleWriteBanner } from "./stale-write-banner";
import { useToast } from "./toast";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

type Props = { mode: "create"; companyId: string } | { mode: "edit"; contract: FleetContract };

const FIELDS = ["productSlug", "startAt", "endAt", "monthlyFee", "deliveryCity"] as const;

// The form that makes a contract or changes one (V2-35, ADMIN.md §3.12). The rules are checked here for comfort and again by the action
// and the API (ADR-26). The product and the start day are chosen once: they are fixed after the contract is made. The fee is typed in
// lira and sent in kuruş. A contract that still has cars is not ended (the API says how many).
export function ContractForm(props: Props) {
  const t = useTranslations("Admin.contracts");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);

  const contract = props.mode === "edit" ? props.contract : null;
  const initial: ContractFormValues = contract ? contractFormValuesOf(contract) : EMPTY_CONTRACT_FORM;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(
      contractFormSchema({ productSlug: t("errors.productSlug"), startAt: t("errors.startAt"), endAt: t("errors.endAt"), monthlyFee: t("errors.monthlyFee"), deliveryCity: t("errors.deliveryCity") }),
    ),
    defaultValues: initial,
  });

  async function onSubmit(values: ContractFormValues) {
    setFormError(null);
    setStale(false);
    const result = contract ? await updateContract(contract.number, contract.updatedAt, values, initial) : await createContract((props as { companyId: string }).companyId, values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(contract ? t("toast.saved") : t("toast.created"));
        if (contract) router.refresh();
        else {
          reset(EMPTY_CONTRACT_FORM);
          router.push({ pathname: "/yonetim/sirketler/[id]/sozlesmeler/[number]", params: { id: (props as { companyId: string }).companyId, number: result.number } });
        }
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if (!(FIELDS as readonly string[]).includes(field)) continue;
          setError(field as keyof ContractFormValues, { message: t(`errors.${field}` as "errors.endAt") });
          shown = true;
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "in_use":
        setFormError(t("errors.inUse", { count: result.vehicles }));
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={contract ? t("form.editLabel") : t("form.newLabel")} className="flex max-w-2xl flex-col gap-5 rounded-card border border-border p-4">
      <UnsavedChangesGuard dirty={isDirty && !done} />
      {!contract && <h3 className="text-label text-fg">{t("form.newTitle")}</h3>}
      <FormError message={formError} />
      {stale && <StaleWriteBanner onReload={() => router.refresh()} />}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.product")} error={errors.productSlug?.message}>
          {(controlProps) => (
            <Select disabled={Boolean(contract)} {...controlProps} {...register("productSlug")}>
              {CONTRACT_PRODUCTS.map((slug) => (
                <option key={slug} value={slug}>
                  {t(`products.${slug}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("fields.deliveryCity")} error={errors.deliveryCity?.message}>
          {(controlProps) => (
            <Select {...controlProps} {...register("deliveryCity")}>
              <option value="">{t("fields.cityChoose")}</option>
              {TURKISH_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.startAt")} error={errors.startAt?.message}>
          {(controlProps) => <Input type="date" disabled={Boolean(contract)} {...controlProps} {...register("startAt")} />}
        </Field>
        <Field label={t("fields.endAt")} error={errors.endAt?.message}>
          {(controlProps) => <Input type="date" {...controlProps} {...register("endAt")} />}
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.monthlyFee")} hint={t("fields.monthlyFeeHint")} error={errors.monthlyFee?.message}>
          {(controlProps) => <Input inputMode="decimal" autoComplete="off" {...controlProps} {...register("monthlyFee")} />}
        </Field>
        {contract && (
          <Field label={t("fields.status")} hint={t("fields.statusHint")}>
            {(controlProps) => (
              <Select {...controlProps} {...register("status")}>
                <option value="ACTIVE">{t("status.ACTIVE")}</option>
                <option value="ENDED">{t("status.ENDED")}</option>
              </Select>
            )}
          </Field>
        )}
      </div>

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("form.saving") : contract ? t("form.save") : t("form.create")}
      </Button>
    </form>
  );
}
