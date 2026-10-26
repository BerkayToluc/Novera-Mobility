"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { FormSuccess } from "@/components/form/form-success";
import { Button } from "@/components/ui/button";
import { emptyQuote, quoteSchema, type QuoteInput } from "@/lib/quote";
import { submitQuote } from "@/lib/quote-actions";
import { QuoteFields } from "./quote-fields";

type Sent = { email: string; reference: string };

// The fields with a message of their own in the message files.
const MESSAGED_FIELDS = ["company", "contactName", "email", "phone", "needs", "cities", "consent"] as const;
type MessagedField = (typeof MESSAGED_FIELDS)[number];

// The corporate request (SPEC §2.2.3, BACKLOG Y16): one form for the home page's corporate box
// and the /kurumsal-teklif page. Once sent it turns into the confirmation in place.
export function QuoteForm({ initialProduct = "", withProduct = false }: { initialProduct?: string; withProduct?: boolean }) {
  const t = useTranslations("QuoteForm");
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const schema = useMemo(
    () =>
      quoteSchema({
        company: t("errors.company"),
        contactName: t("errors.contactName"),
        email: t("errors.email"),
        phone: t("errors.phone"),
        needs: t("errors.needs"),
        cities: t("errors.cities"),
        consent: t("errors.consent"),
      }),
    [t],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuoteInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: emptyQuote(initialProduct),
    // The library focuses in registration order, which puts the need chips first; the first
    // invalid control in reading order is what a keyboard user expects (see focusFirstError).
    shouldFocusError: false,
  });

  function focusFirstError(form: HTMLFormElement) {
    // After the errors have rendered, so aria-invalid is already on the controls.
    setTimeout(() => form.querySelector<HTMLElement>("[aria-invalid=\"true\"]")?.focus(), 0);
  }

  // The fields the server rejected get the same message the browser's check would have given, beside the
  // field. False when none of them has a message (a hidden or select field), so the form says it as a whole.
  function markRejected(fields: string[]): boolean {
    const known = fields.filter((field): field is MessagedField => (MESSAGED_FIELDS as readonly string[]).includes(field));
    for (const field of known) setError(field, { type: "server", message: t(`errors.${field}`) });
    return known.length > 0;
  }

  async function onSubmit(values: QuoteInput) {
    setFormError(null);
    try {
      const result = await submitQuote(values);
      if (result.ok) setSent({ email: values.email, reference: result.reference });
      else if (result.reason === "invalid" && markRejected(result.fields)) setFormError(null);
      else setFormError(t(result.reason === "invalid" ? "errors.invalid" : result.reason === "rate_limited" ? "errors.rateLimited" : "errors.unavailable"));
    } catch {
      setFormError(t("errors.generic"));
    }
  }

  if (sent) {
    return (
      <FormSuccess
        title={t("sent.title")}
        text={t("sent.text", { email: sent.email })}
        detail={
          <p className="text-body text-fg">
            {t("sent.reference")} <strong className="tabular-nums">{sent.reference}</strong>
          </p>
        }
      >
        <Button
          variant="outline"
          onClick={() => {
            reset(emptyQuote(initialProduct));
            setSent(null);
          }}
        >
          {t("sent.again")}
        </Button>
      </FormSuccess>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        const form = event.currentTarget;
        return handleSubmit(onSubmit, () => focusFirstError(form))(event);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <FormError message={formError} />
      <div className="grid gap-5 md:grid-cols-2">
        <QuoteFields register={register} control={control} errors={errors} withProduct={withProduct} />
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="md:self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
