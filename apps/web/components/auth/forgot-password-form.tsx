"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthUnavailableError, requestPasswordReset } from "@/lib/auth-client";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth-schemas";
import { FormError } from "./form-error";
import { useAuthErrorMessages } from "./use-auth-messages";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const messages = useAuthErrorMessages();
  const schema = useMemo(() => forgotPasswordSchema(messages), [messages]);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await requestPasswordReset(values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(error instanceof AuthUnavailableError ? t("errors.unavailable") : t("errors.generic"));
    }
  }

  // The same wording whether or not the address has an account, so the form cannot be
  // used to find out who is registered.
  if (sentTo) {
    return (
      <p role="status" className="rounded-control bg-surface-muted p-4 text-body text-fg">
        {t("forgot.sent", { email: sentTo })}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <Field label={t("fields.email")} error={errors.email?.message}>
        {(props) => <Input type="email" autoComplete="email" inputMode="email" {...props} {...register("email")} />}
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("forgot.submitting") : t("forgot.submit")}
      </Button>
    </form>
  );
}
