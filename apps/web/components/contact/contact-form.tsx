"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { ConsentCheckbox } from "@/components/form/consent-checkbox";
import { FormSuccess } from "@/components/form/form-success";
import { Honeypot } from "@/components/form/honeypot";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_TOPICS, EMPTY_CONTACT, contactSchema, type ContactInput } from "@/lib/contact";
import { sendContact } from "@/lib/contact-actions";

type Sent = { email: string; reference: string };

// The contact form (SPEC §2.6). Once sent it turns into the confirmation in place, with a
// reference the visitor can quote; see the quote form for the same pattern.
export function ContactForm() {
  const t = useTranslations("ContactForm");
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const schema = useMemo(
    () =>
      contactSchema({
        name: t("errors.name"),
        email: t("errors.email"),
        phone: t("errors.phone"),
        message: t("errors.message"),
        consent: t("errors.consent"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: EMPTY_CONTACT,
    // Focus goes to the first invalid field in reading order, set in the submit handler below.
    shouldFocusError: false,
  });

  async function onSubmit(values: ContactInput) {
    setFormError(null);
    try {
      const result = await sendContact(values);
      if (result.ok) setSent({ email: values.email, reference: result.reference });
      else setFormError(t(result.reason === "invalid" ? "errors.invalid" : "errors.unavailable"));
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
            reset(EMPTY_CONTACT);
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
        // The first invalid field in reading order takes focus, not the first registered one.
        const form = event.currentTarget;
        return handleSubmit(onSubmit, () =>
          setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0),
        )(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <FormError message={formError} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("name")} error={errors.name?.message}>
          {(control) => <Input autoComplete="name" {...control} {...register("name")} />}
        </Field>
        <Field label={t("email")} error={errors.email?.message}>
          {(control) => <Input type="email" autoComplete="email" {...control} {...register("email")} />}
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} error={errors.phone?.message}>
          {(control) => <Input type="tel" autoComplete="tel" {...control} {...register("phone")} />}
        </Field>
        <Field label={t("topic")}>
          {(control) => (
            <Select {...control} {...register("topic")}>
              {CONTACT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {t(`topics.${topic}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("message")} error={errors.message?.message} className="md:col-span-2">
          {(control) => <Textarea rows={5} {...control} {...register("message")} />}
        </Field>
        <div className="md:col-span-2">
          <ConsentCheckbox error={errors.consent?.message} {...register("consent")} />
        </div>
        <Honeypot {...register("website")} />
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="md:self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
