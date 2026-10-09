"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link } from "@/i18n/navigation";
import { AuthUnavailableError, register as registerAccount } from "@/lib/auth-client";
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from "@/lib/auth-schemas";
import { FormError } from "./form-error";
import { useAuthErrorMessages } from "./use-auth-messages";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const messages = useAuthErrorMessages();
  const schema = useMemo(() => registerSchema(messages), [messages]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { firstName: "", lastName: "", email: "", password: "", consent: false },
  });

  // Register every field here, top to bottom. React Hook Form focuses the first invalid
  // field in registration order, and a field registered inside a child component (the
  // Field render props) is registered after one registered in this component, which
  // would send focus to the last field instead of the first.
  const fields = {
    firstName: register("firstName"),
    lastName: register("lastName"),
    email: register("email"),
    password: register("password"),
    consent: register("consent"),
  };
  const consentErrorId = useId();

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await registerAccount(values);
    } catch (error) {
      setFormError(error instanceof AuthUnavailableError ? t("errors.unavailable") : t("errors.generic"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.firstName")} error={errors.firstName?.message}>
          {(props) => <Input autoComplete="given-name" {...props} {...fields.firstName} />}
        </Field>
        <Field label={t("fields.lastName")} error={errors.lastName?.message}>
          {(props) => <Input autoComplete="family-name" {...props} {...fields.lastName} />}
        </Field>
      </div>
      <Field label={t("fields.email")} error={errors.email?.message}>
        {(props) => <Input type="email" autoComplete="email" inputMode="email" {...props} {...fields.email} />}
      </Field>
      <Field
        label={t("fields.password")}
        hint={t("fields.passwordHint", { count: PASSWORD_MIN_LENGTH })}
        error={errors.password?.message}
      >
        {(props) => (
          <PasswordInput
            autoComplete="new-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            {...props}
            {...fields.password}
          />
        )}
      </Field>
      <div className="flex flex-col gap-1">
        <Checkbox
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? consentErrorId : undefined}
          {...fields.consent}
        >
          {t.rich("register.consent", {
            link: (chunks) => (
              <Link href="/kvkk" className="text-link underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </Checkbox>
        {errors.consent && (
          <p id={consentErrorId} className="text-small text-error">
            {errors.consent.message}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("register.submitting") : t("register.submit")}
      </Button>
    </form>
  );
}
