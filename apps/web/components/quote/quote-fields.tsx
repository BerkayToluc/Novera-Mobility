"use client";

import { useTranslations } from "next-intl";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PRODUCTS } from "@/lib/products";
import { QUOTE_TERMS, QUOTE_VEHICLE_TYPES, type QuoteInput } from "@/lib/quote-prefill";

type QuoteFieldsProps = {
  register: UseFormRegister<QuoteInput>;
  errors: FieldErrors<QuoteInput>;
  // The home form is short; the quote page also asks which product the visitor has in mind.
  withProduct?: boolean;
};

// The inputs both quote forms share, laid out as a two-column grid from `md`. The caller
// owns the <form>, the submit button and the grid, so each can place them as it needs.
export function QuoteFields({ register, errors, withProduct = false }: QuoteFieldsProps) {
  const t = useTranslations("QuoteForm");
  const products = useTranslations("ProductsPage");

  return (
    <>
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
      {withProduct && (
        <Field label={t("product")} className="md:col-span-2">
          {(control) => (
            <Select {...control} {...register("product")}>
              <option value="">{t("noProduct")}</option>
              {PRODUCTS.map(({ slug }) => (
                <option key={slug} value={slug}>
                  {products(`items.${slug}.title`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label={t("email")} error={errors.email?.message} className="md:col-span-2">
        {(control) => <Input type="email" autoComplete="email" {...control} {...register("email")} />}
      </Field>
    </>
  );
}
