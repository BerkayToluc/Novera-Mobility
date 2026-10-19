"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { placeReservation, type DriverBody } from "@/app/[locale]/odeme/actions";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { DriverSection } from "./driver-section";
import { formatCardNumber, formatExpiry, paymentSchema, type PaymentInput } from "@/lib/payment-schema";

// The card fields are only checked here, in the browser: what goes to the server is the
// booking from the URL and the driver's details (SPEC §2.10), never the card. The demo notice
// above the form says the same. The driver section comes first, and the payment button waits for it.
export function PaymentForm({
  query,
  rentalStart,
}: {
  query: Record<string, string>;
  rentalStart: string;
}) {
  const t = useTranslations("Payment");
  const d = useTranslations("Driver");
  const [driver, setDriver] = useState<DriverBody | null>(null);
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
    if (!driver) return;
    setFormError(null);
    try {
      const result = await placeReservation(query, driver);
      if (result.ok) {
        // The hold is spent by now, so it does not travel on to the confirmation.
        const { tutma: spent, ...rest } = query;
        void spent;
        router.push({ pathname: "/rezervasyon/onay", query: { ...rest, no: result.number } });
        return;
      }
      // Time ran out while paying: this page asks the server again and shows the "time is up" screen.
      if (result.reason === "expired") {
        router.refresh();
        return;
      }
      // Someone else got the car first: the summary explains it and leads back to the search.
      if (result.reason === "taken") {
        router.push({ pathname: "/rezervasyon", query: { ...query, durum: "dolu" } });
        return;
      }
      // The campaign code stopped being valid while paying: the page prices the booking again without it,
      // and the visitor decides whether to go on.
      if (result.reason === "promo") {
        const { kod: dropped, ...withoutCode } = query;
        void dropped;
        router.replace({ pathname: "/odeme", query: withoutCode });
        setFormError(t("errors.promo"));
        return;
      }
      setFormError(t(result.reason === "not_verified" ? "errors.notVerified" : `errors.${result.reason}`));
    } catch {
      setFormError(t("errors.generic"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DriverSection rentalStart={rentalStart} onReady={setDriver} />
      <div className="rounded-card border border-border bg-surface p-6 md:p-8">
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
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting || !driver}
        aria-busy={isSubmitting}
        aria-describedby={driver ? undefined : "pay-blocked"}
        className="self-start"
      >
        {isSubmitting ? t("paying") : t("pay")}
      </Button>
      {!driver && (
        <p id="pay-blocked" className="text-small text-fg-muted">
          {d("payBlocked")}
        </p>
      )}
    </form>
      </div>
    </div>
  );
}
