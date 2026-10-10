"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import {
  QUOTE_TERMS,
  QUOTE_VEHICLE_TYPES,
  quotePrefillSchema,
  toQuoteQuery,
  type QuotePrefillInput,
} from "@/lib/quote-prefill";

export function CorporateQuoteForm() {
  const t = useTranslations("HomeQuote");
  const router = useRouter();

  const schema = useMemo(
    () =>
      quotePrefillSchema({
        company: t("errors.company"),
        count: t("errors.count"),
        email: t("errors.email"),
      }),
    [t],
  );

  const { register, handleSubmit, formState } = useForm<QuotePrefillInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { company: "", count: "", term: "12", vehicleType: "economy", email: "" },
  });
  const { errors } = formState;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        router.push({ pathname: "/kurumsal-teklif", query: toQuoteQuery(values) }),
      )}
      className="grid gap-4 md:grid-cols-2"
    >
      <Field label={t("company")} error={errors.company?.message}>
        {(control) => <Input autoComplete="organization" {...control} {...register("company")} />}
      </Field>
      <Field label={t("count")} error={errors.count?.message}>
        {(control) => <Input inputMode="numeric" autoComplete="off" {...control} {...register("count")} />}
      </Field>
      <Field label={t("term")}>
        {(control) => (
          <Select {...control} {...register("term")}>
            {QUOTE_TERMS.map((months) => (
              <option key={months} value={months}>
                {t("termOption", { months })}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("vehicleType")}>
        {(control) => (
          <Select {...control} {...register("vehicleType")}>
            {QUOTE_VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("email")} error={errors.email?.message} className="md:col-span-2">
        {(control) => <Input type="email" autoComplete="email" {...control} {...register("email")} />}
      </Field>
      <Button type="submit" size="lg" className="md:col-span-2 md:justify-self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
