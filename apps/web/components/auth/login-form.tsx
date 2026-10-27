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
import { AuthRateLimitedError, AuthUnavailableError, InvalidCredentialsError, login } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/auth-schemas";
import type { AccountType } from "@/lib/session";
import { FormError } from "./form-error";
import { useAuthErrorMessages } from "./use-auth-messages";
import { rateLimitMessage } from "@/lib/rate-limit";

// `next`: the booking to go back to after signing in (the payment page asked for it).
export function LoginForm({ next, kind = "individual" }: { next?: Record<string, string>; kind?: AccountType }) {
  const t = useTranslations("Auth");
  const limitT = useTranslations("RateLimit");
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
      const locale = await login(values, kind);
      if (next) router.push({ pathname: "/odeme", query: next }, { locale });
      else router.push("/profil", { locale });
      // The header reads the session on the server, so it has to be asked again.
      router.refresh();
    } catch (error) {
      if (error instanceof InvalidCredentialsError) setFormError(t("errors.invalidCredentials"));
      else if (error instanceof AuthRateLimitedError) setFormError(rateLimitMessage(limitT, error.retryAfter));
      else if (error instanceof AuthUnavailableError) setFormError(t("errors.unavailable"));
      else setFormError(t("errors.generic"));
    }
  }

  return (
    // noValidate: our own messages replace the browser's bubbles, in both languages.
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <Field label={kind === "corporate" ? t("fields.companyEmail") : t("fields.email")} error={errors.email?.message}>
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
        className="inline-flex min-h-11 items-center self-start text-link underline underline-offset-4"
      >
        {t("login.forgot")}
      </Link>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
