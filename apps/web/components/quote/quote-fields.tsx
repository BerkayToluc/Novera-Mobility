"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ConsentCheckbox } from "@/components/form/consent-checkbox";
import { Honeypot } from "@/components/form/honeypot";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { PRODUCTS } from "@/lib/products";
import { FLEET_SIZES, QUOTE_NEEDS, QUOTE_TERMS, type QuoteInput } from "@/lib/quote";

type QuoteFieldsProps = {
  register: UseFormRegister<QuoteInput>;
  errors: FieldErrors<QuoteInput>;
  // The quote page also asks which product the visitor has in mind; the home box does not.
  withProduct?: boolean;
};

// The inputs of the corporate request, laid out as a two-column grid from `md`. The caller
// owns the <form>, the grid and the submit button.
export function QuoteFields({ register, errors, withProduct = false }: QuoteFieldsProps) {
  const t = useTranslations("QuoteForm");
  const products = useTranslations("ProductsPage");
  const needsHintId = useId();
  const needsErrorId = useId();

  return (
    <>
      <Field label={t("company")} error={errors.company?.message}>
        {(control) => <Input autoComplete="organization" {...control} {...register("company")} />}
      </Field>
      <Field label={t("contactName")} error={errors.contactName?.message}>
        {(control) => <Input autoComplete="name" {...control} {...register("contactName")} />}
      </Field>
      <Field label={t("email")} error={errors.email?.message}>
        {(control) => <Input type="email" autoComplete="email" {...control} {...register("email")} />}
      </Field>
      <Field label={t("phone")} error={errors.phone?.message}>
        {(control) => <Input type="tel" autoComplete="tel" {...control} {...register("phone")} />}
      </Field>
      <Field label={t("fleetSize")}>
        {(control) => (
          <Select {...control} {...register("fleetSize")}>
            {FLEET_SIZES.map((size) => (
              <option key={size} value={size}>
                {t(`fleetSizes.${size}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("term")}>
        {(control) => (
          <Select {...control} {...register("term")}>
            {QUOTE_TERMS.map((term) => (
              <option key={term} value={term}>
                {t(`terms.${term}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* Several kinds can apply, so these are checkboxes, drawn as chips. */}
      <fieldset
        aria-describedby={cn(needsHintId, errors.needs && needsErrorId)}
        className="flex flex-col gap-2 md:col-span-2"
      >
        <legend className="mb-2 text-label text-fg">{t("needs")}</legend>
        <p id={needsHintId} className="text-small text-fg-muted">
          {t("needsHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          {QUOTE_NEEDS.map((need) => (
            <label key={need} className="relative">
              <input
                type="checkbox"
                value={need}
                aria-invalid={errors.needs ? true : undefined}
                className="peer sr-only"
                {...register("needs")}
              />
              <span className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border-strong px-4 text-label text-fg transition-colors peer-checked:border-primary peer-checked:bg-selected peer-checked:text-on-selected peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-not-checked:hover:bg-surface-muted">
                {t(`needOptions.${need}`)}
              </span>
            </label>
          ))}
        </div>
        {errors.needs && (
          <p id={needsErrorId} className="text-small text-error">
            {errors.needs.message}
          </p>
        )}
      </fieldset>

      <Field label={t("cities")} hint={t("citiesHint")} error={errors.cities?.message} className="md:col-span-2">
        {(control) => <Input autoComplete="off" {...control} {...register("cities")} />}
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

      <Field label={t("note")} className="md:col-span-2">
        {(control) => <Textarea {...control} {...register("note")} />}
      </Field>

      <div className="md:col-span-2">
        <ConsentCheckbox error={errors.consent?.message} {...register("consent")} />
      </div>
      <Honeypot {...register("website")} />
    </>
  );
}
