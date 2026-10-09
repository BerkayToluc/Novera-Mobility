"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link, useRouter } from "@/i18n/navigation";
import { AuthUnavailableError, login } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/auth-schemas";
import { FormError } from "./form-error";
import { useAuthErrorMessages } from "./use-auth-messages";

// `next`: the booking to go back to after signing in (the payment page asked for it).
export function LoginForm({ next }: { next?: Record<string, string> }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const messages = useAuthErrorMessages();
  const schema = useMemo(() => loginSchema(messages), [messages]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(schema),
    // Validate a field when the visitor leaves it, then keep it live: errors appear
    // next to the field without nagging while the first character is still being typed.
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await login(values);
      if (next) router.push({ pathname: "/odeme", query: next });
    } catch (error) {
      setFormError(error instanceof AuthUnavailableError ? t("errors.unavailable") : t("errors.generic"));
    }
  }

  return (
    // noValidate: our own messages replace the browser's bubbles, in both languages.
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <Field label={t("fields.email")} error={errors.email?.message}>
        {(props) => <Input type="email" autoComplete="email" inputMode="email" {...props} {...register("email")} />}
      </Field>
      <Field label={t("fields.password")} error={errors.password?.message}>
        {(props) => (
          <PasswordInput
            autoComplete="current-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            {...props}
            {...register("password")}
          />
        )}
      </Field>
      <Link
        href="/sifre-sifirla"
        className="inline-flex min-h-11 items-center self-start text-link underline-offset-4 hover:underline"
      >
        {t("login.forgot")}
      </Link>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
