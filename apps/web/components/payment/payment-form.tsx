"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { placeReservation } from "@/app/[locale]/odeme/actions";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { formatCardNumber, formatExpiry, paymentSchema, type PaymentInput } from "@/lib/payment-schema";

// The card fields are only checked here, in the browser: what goes to the server is the
// booking from the URL and nothing else. The demo notice above the form says the same.
export function PaymentForm({ query }: { query: Record<string, string> }) {
  const t = useTranslations("Payment");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      paymentSchema({
        holder: t("errors.holder"),
        number: t("errors.number"),
        expiry: t("errors.expiry"),
        cvc: t("errors.cvc"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { holder: "", number: "", expiry: "", cvc: "" },
  });

  // Groups the digits as they are typed; the stored value stays what the field shows.
  const formatted = (name: "number" | "expiry", format: (value: string) => string) => {
    const field = register(name);
    return {
      ...field,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        event.target.value = format(event.target.value);
        return field.onChange(event);
      },
    };
  };

  async function onSubmit() {
    setFormError(null);
    try {
      const result = await placeReservation(query);
      if (result.ok) {
        router.push({ pathname: "/rezervasyon/onay", query: { ...query, no: result.number } });
        return;
      }
      setFormError(t(`errors.${result.reason}`));
    } catch {
      setFormError(t("errors.generic"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <Field label={t("fields.holder")} error={errors.holder?.message}>
        {(props) => <Input autoComplete="cc-name" {...props} {...register("holder")} />}
      </Field>
      <Field label={t("fields.number")} error={errors.number?.message}>
        {(props) => (
          <Input
            inputMode="numeric"
            autoComplete="cc-number"
            {...props}
            {...formatted("number", formatCardNumber)}
          />
        )}
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.expiry")} error={errors.expiry?.message}>
          {(props) => (
            <Input
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="12/30"
              {...props}
              {...formatted("expiry", formatExpiry)}
            />
          )}
        </Field>
        <Field label={t("fields.cvc")} error={errors.cvc?.message}>
          {(props) => <Input inputMode="numeric" autoComplete="cc-csc" maxLength={4} {...props} {...register("cvc")} />}
        </Field>
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="self-start">
        {isSubmitting ? t("paying") : t("pay")}
      </Button>
    </form>
  );
}
