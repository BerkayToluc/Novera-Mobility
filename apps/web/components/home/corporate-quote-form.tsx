"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QuoteFields } from "@/components/quote/quote-fields";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { EMPTY_QUOTE, quoteSchema, toQuoteQuery, type QuoteInput } from "@/lib/quote-prefill";

export function CorporateQuoteForm() {
  const t = useTranslations("QuoteForm");
  const router = useRouter();

  const schema = useMemo(
    () =>
      quoteSchema({
        company: t("errors.company"),
        count: t("errors.count"),
        email: t("errors.email"),
      }),
    [t],
  );

  const { register, handleSubmit, formState } = useForm<QuoteInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: EMPTY_QUOTE,
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        router.push({ pathname: "/kurumsal-teklif", query: toQuoteQuery(values) }),
      )}
      className="grid gap-4 md:grid-cols-2"
    >
      <QuoteFields register={register} errors={formState.errors} />
      <Button type="submit" size="lg" className="md:col-span-2 md:justify-self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
