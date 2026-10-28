"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkLicence, type DriverBody } from "@/app/[locale]/odeme/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { checkEligibility, isIsoDate } from "@/lib/driver-eligibility";
import { isLicenceCountry, LICENCE_COUNTRIES, needsInternationalPermit, requirementsFor } from "@/lib/driver-rules";
import { driverSchema, type DriverInput } from "@/lib/driver-schema";
import type { LicenceStatus } from "@/lib/licence-client";

type Props = {
  // The booked car's class decides the rule (SPEC §2.10); the rental's first day is when it is counted.
  rentalStart: string;
  // The search that led here, so "choose another car" goes back to its results.
  // The driver's details once they are valid, eligible and checked; null while any of that is missing.
  onReady: (driver: DriverBody | null) => void;
};

// The driver's details and the (simulated) licence check, above the card form (SPEC §2.10). It only
// reports upward when the driver may drive this car: the payment button waits for that. Nothing is
// written to the address, the browser's storage or a cookie; reloading empties the fields.
export function DriverSection({ rentalStart, onReady }: Props) {
  const t = useTranslations("Driver");
  const [result, setResult] = useState<{ key: string; status: LicenceStatus } | null>(null);
  const [checking, setChecking] = useState(false);

  const schema = useMemo(
    () =>
      driverSchema({
        birthDate: t("errors.birthDate"),
        country: t("errors.country"),
        licenceNumber: t("errors.licenceNumber"),
        licenceIssuedAt: t("errors.licenceIssuedAt"),
        licenceBeforeBirth: t("errors.licenceBeforeBirth"),
        permit: t("errors.permit"),
        declaration: t("errors.declaration"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DriverInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      birthDate: "",
      country: "" as DriverInput["country"],
      licenceNumber: "",
      licenceIssuedAt: "",
      permit: false,
      declaration: false,
    },
  });

  // useWatch hands back every field as possibly missing; the form always has all of them.
  const watched = useWatch({ control });
  const values = {
    birthDate: watched.birthDate ?? "",
    country: watched.country ?? ("" as DriverInput["country"]),
    licenceNumber: watched.licenceNumber ?? "",
    licenceIssuedAt: watched.licenceIssuedAt ?? "",
    permit: watched.permit ?? false,
    declaration: watched.declaration ?? false,
  };
  const country = isLicenceCountry(values.country) ? values.country : null;
  // What the check is about: any change to it throws a finished check away.
  const key = [values.birthDate, values.country, values.licenceNumber.trim(), values.licenceIssuedAt, values.permit].join("|");

  const requirements = country ? requirementsFor(country) : null;
  const eligibility =
    requirements && isIsoDate(values.birthDate) && isIsoDate(values.licenceIssuedAt)
      ? checkEligibility(values, requirements, rentalStart)
      : null;

  const status = result?.key === key ? result.status : null;
  const permitOk = !country || !needsInternationalPermit(country) || values.permit;
  const ready = status === "valid" && eligibility?.ok === true && permitOk && values.declaration;

  const payload: DriverBody | null = ready
    ? {
        birthDate: values.birthDate,
        country: values.country,
        licenceNumber: values.licenceNumber.trim(),
        licenceIssuedAt: values.licenceIssuedAt,
        permit: values.permit,
      }
    : null;
  const payloadKey = payload ? key : "";
  // `payloadKey` stands for the payload's contents, so the parent hears of changes only; the effect event reads the
  // payload of that render without making every render a change (V2-14, QUALITY M-09: this was a disabled lint rule).
  const tellParent = useEffectEvent(() => onReady(payload));
  useEffect(() => {
    tellParent();
  }, [payloadKey]);

  async function verify(data: DriverInput) {
    if (!eligibility?.ok) return;
    setChecking(true);
    try {
      const outcome = await checkLicence({
        country: data.country,
        licenceNumber: data.licenceNumber.trim(),
        licenceIssuedAt: data.licenceIssuedAt,
      });
      setResult({ key, status: outcome });
    } catch {
      setResult({ key, status: "unavailable" });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section
      aria-labelledby="driver-title"
      className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6 md:p-8"
    >
      <header className="flex flex-col gap-2">
        <h2 id="driver-title" className="text-h2 text-fg">
          {t("title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div role="note" className="flex items-start gap-3 rounded-card border border-border-strong bg-accent-soft p-4 text-on-accent-soft">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-label">{t("demoTitle")}</p>
          <p className="text-body">{t("demoText")}</p>
          <p className="text-small">{t("demoHint")}</p>
        </div>
      </div>

      {/* Not a <form>: it sits next to the payment form, and pressing Enter here must not submit that one. */}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("fields.birthDate")} error={errors.birthDate?.message}>
          {(props) => <Input type="date" autoComplete="bday" {...props} {...register("birthDate")} />}
        </Field>
        <Field label={t("fields.country")} error={errors.country?.message}>
          {(props) => (
            <Select {...props} {...register("country")}>
              <option value="">{t("fields.countryChoose")}</option>
              {LICENCE_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {t(`countries.${code}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("fields.licenceNumber")} error={errors.licenceNumber?.message}>
          {(props) => <Input autoComplete="off" maxLength={12} {...props} {...register("licenceNumber")} />}
        </Field>
        <Field label={t("fields.licenceIssuedAt")} error={errors.licenceIssuedAt?.message}>
          {(props) => <Input type="date" autoComplete="off" {...props} {...register("licenceIssuedAt")} />}
        </Field>
      </div>

      {country && needsInternationalPermit(country) && (
        <div className="flex flex-col gap-1">
          <Checkbox aria-invalid={errors.permit ? true : undefined} {...register("permit")}>
            {t("fields.permit")}
          </Checkbox>
          {errors.permit && <p className="text-small text-error">{errors.permit.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Checkbox aria-invalid={errors.declaration ? true : undefined} {...register("declaration")}>
          {t("fields.declaration")}
        </Checkbox>
        {errors.declaration && <p className="text-small text-error">{errors.declaration.message}</p>}
      </div>

      {requirements && eligibility?.ok && (
        <p role="status" className="text-body text-fg">
          {t("eligible", { age: requirements.minAge })}
        </p>
      )}
      {requirements && eligibility && !eligibility.ok && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-error p-4">
          <p className="text-label text-error">{t("ineligibleTitle")}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-fg">
            {eligibility.reasons.includes("age") && (
              <li>{t("ineligibleAge", { min: requirements.minAge, have: eligibility.ageYears })}</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col items-start gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={checking || (eligibility !== null && !eligibility.ok)}
          aria-busy={checking}
          onClick={handleSubmit(verify)}
        >
          {checking ? t("verifying") : t("verify")}
        </Button>
        {status && (
          <p role="status" className={status === "valid" ? "text-body text-fg" : "text-body text-error"}>
            {t(`result.${status}`)}
          </p>
        )}
      </div>
    </section>
  );
}
