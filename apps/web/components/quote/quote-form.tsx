"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { QuoteUnavailableError, submitQuote } from "@/lib/quote-client";
import { quoteSchema, type QuoteInput } from "@/lib/quote-prefill";
import { QuoteFields } from "./quote-fields";

export function QuoteForm({ initial }: { initial: QuoteInput }) {
  const t = useTranslations("QuoteForm");
  const page = useTranslations("QuotePage");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      quoteSchema({
        company: t("errors.company"),
        count: t("errors.count"),
        email: t("errors.email"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuoteInput>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: initial });

  async function onSubmit(values: QuoteInput) {
    setFormError(null);
    try {
      await submitQuote(values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(
        error instanceof QuoteUnavailableError ? page("errors.unavailable") : page("errors.generic"),
      );
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <h2 className="text-h3 text-fg">{page("sent.title")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{page("sent.text", { email: sentTo })}</p>
        <Button asChild variant="outline">
          <Link href="/">{page("sent.home")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <div className="grid gap-4 md:grid-cols-2">
        <QuoteFields register={register} errors={errors} withProduct />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="self-start"
      >
        {isSubmitting ? page("submitting") : t("submit")}
      </Button>
    </form>
  );
}
