"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard";
import { useToast } from "@/components/admin/toast";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { rateLimitMessage } from "@/lib/rate-limit";
import { createRequest } from "@/lib/request-actions";
import { AIRPORTS, CUSTOMER_TYPES, EMPTY_REQUEST_FORM, INCIDENTS, MAINTENANCE_SERVICES, requestFormSchema, roundCoordinate, type RequestFormValues } from "@/lib/requests";

type Props = {
  vehicles: Array<{ id: string; label: string }>;
  // The Istanbul day today, for the dates that cannot be in the past.
  today: string;
  initialType?: string;
  initialVehicle?: string;
  // The company has a VIP Mobilite contract, so a transfer can be asked for (V2-42); without one the choice is not shown.
  transferEnabled?: boolean;
};

type Position = "idle" | "asking" | "got" | "denied";

// The form that opens a service request (V2-41, docs/FLEET.md §3, SPEC §3.D): the kind first, then the fields of that kind. "Use my location"
// is a button that asks the browser only when it is pressed, never by itself; if the position is refused or cannot be had, the address field
// is all that is needed and the form works as before. The rules are checked here for comfort and again by the action and the API (ADR-26).
export function RequestForm({ vehicles, today, initialType, initialVehicle, transferEnabled = false }: Props) {
  const t = useTranslations("FleetPanel.requestForm");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>("idle");
  const [done, setDone] = useState(false);

  const initial: RequestFormValues = {
    ...EMPTY_REQUEST_FORM,
    type: [...CUSTOMER_TYPES, ...(transferEnabled ? ["TRANSFER"] : [])].includes(initialType ?? "") ? (initialType as string) : "",
    fleetVehicleId: vehicles.some((vehicle) => vehicle.id === initialVehicle) ? (initialVehicle as string) : "",
  };
  const messages = {
    type: t("errors.type"),
    fleetVehicleId: t("errors.fleetVehicleId"),
    incident: t("errors.incident"),
    location: t("errors.location"),
    address: t("errors.address"),
    description: t("errors.description"),
    date: t("errors.date"),
    durationDays: t("errors.durationDays"),
    service: t("errors.service"),
    preferredDate: t("errors.preferredDate"),
    passengerName: t("errors.passengerName"),
    passengers: t("errors.passengers"),
    flightNumber: t("errors.flightNumber"),
    meeting: t("errors.meeting"),
    meetingAt: t("errors.meetingAt"),
    destination: t("errors.destination"),
    note: t("errors.note"),
  };
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RequestFormValues>({ resolver: zodResolver(requestFormSchema(messages, today)), defaultValues: initial });
  const type = useWatch({ control, name: "type" });
  const valet = useWatch({ control, name: "valet" });
  const meetingKind = useWatch({ control, name: "meetingKind" });
  const latitude = useWatch({ control, name: "latitude" });
  const longitude = useWatch({ control, name: "longitude" });

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setPosition("denied");
      return;
    }
    setPosition("asking");
    navigator.geolocation.getCurrentPosition(
      (found) => {
        setValue("latitude", roundCoordinate(found.coords.latitude), { shouldDirty: true });
        setValue("longitude", roundCoordinate(found.coords.longitude), { shouldDirty: true });
        setPosition("got");
      },
      () => setPosition("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function forgetLocation() {
    setValue("latitude", "", { shouldDirty: true });
    setValue("longitude", "", { shouldDirty: true });
    setPosition("idle");
  }

  async function onSubmit(values: RequestFormValues) {
    setFormError(null);
    const result = await createRequest(values);
    switch (result.status) {
      case "ok":
        setDone(true);
        toast.show(result.similarOpen.length > 0 ? t("toast.createdWithOpen", { number: result.number, others: result.similarOpen.join(", ") }) : t("toast.created", { number: result.number }));
        router.push({ pathname: "/filom/talepler/[number]", params: { number: result.number } });
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          const name = field.startsWith("details.") ? field.slice("details.".length).split(".")[0]! : field;
          // The position problem is shown at the address, the meeting place at the airport or the address, whichever is chosen.
          const mapped = name === "location" ? "address" : name === "meeting" ? (values.meetingKind === "airport" ? "airport" : "address") : name;
          if (mapped in EMPTY_REQUEST_FORM) {
            setError(mapped as keyof RequestFormValues, { message: messages[name as keyof typeof messages] ?? t("errors.generic") });
            shown = true;
          }
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "forbidden":
        setFormError(t("errors.forbidden"));
        return;
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setFormError(t("errors.unavailable"));
    }
  }

  const hasPosition = latitude.trim() !== "" && longitude.trim() !== "";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={t("label")} className="flex max-w-2xl flex-col gap-6 rounded-card border border-border p-4 md:p-6">
      <UnsavedChangesGuard dirty={isDirty && !done} />
      <FormError message={formError} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-label text-fg">{t("type.legend")}</legend>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[...CUSTOMER_TYPES, ...(transferEnabled ? (["TRANSFER"] as const) : [])].map((kind) => (
            <label key={kind} className={`flex min-h-11 cursor-pointer flex-col gap-1 rounded-card border p-4 ${type === kind ? "border-primary bg-selected" : "border-border-strong bg-surface"}`}>
              <span className="flex items-center gap-3">
                <input type="radio" value={kind} className="size-5 shrink-0" {...register("type")} />
                <span className="text-label text-fg">{t(`type.${kind}.title`)}</span>
              </span>
              <span className="text-small text-fg-muted">{t(`type.${kind}.text`)}</span>
            </label>
          ))}
        </div>
        {errors.type && <p className="text-small text-error">{errors.type.message}</p>}
      </fieldset>

      {type && (
        <>
          {type !== "TRANSFER" && (
            <Field label={t("fields.vehicle")} error={errors.fleetVehicleId?.message}>
              {(controlProps) => (
                <Select {...controlProps} {...register("fleetVehicleId")}>
                  <option value="">{t("fields.vehicleChoose")}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {type === "ROADSIDE" && (
            <>
              <Field label={t("fields.incident")} error={errors.incident?.message}>
                {(controlProps) => (
                  <Select {...controlProps} {...register("incident")}>
                    <option value="">{t("fields.incidentChoose")}</option>
                    {INCIDENTS.map((incident) => (
                      <option key={incident} value={incident}>
                        {t(`incidents.${incident}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex flex-col gap-3">
                <Field label={t("fields.address")} hint={t("fields.roadsideAddressHint")} error={errors.address?.message}>
                  {(controlProps) => <Input autoComplete="street-address" {...controlProps} {...register("address")} />}
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" disabled={position === "asking"} onClick={useMyLocation}>
                    <LocateFixed aria-hidden="true" className="size-4" />
                    {position === "asking" ? t("location.asking") : t("location.button")}
                  </Button>
                  {hasPosition && (
                    <>
                      <p role="status" className="text-small text-fg">
                        {t("location.got", { latitude, longitude })}
                      </p>
                      <Button type="button" variant="ghost" onClick={forgetLocation}>
                        {t("location.forget")}
                      </Button>
                    </>
                  )}
                </div>
                {position === "denied" && (
                  <p role="status" className="text-small text-fg-muted">
                    {t("location.denied")}
                  </p>
                )}
                <input type="hidden" {...register("latitude")} />
                <input type="hidden" {...register("longitude")} />
              </div>
              <Field label={t("fields.description")} hint={t("fields.descriptionHint")} error={errors.description?.message}>
                {(controlProps) => <Textarea rows={3} {...controlProps} {...register("description")} />}
              </Field>
            </>
          )}

          {type === "REPLACEMENT_VEHICLE" && (
            <>
              <Field label={t("fields.deliveryAddress")} error={errors.address?.message}>
                {(controlProps) => <Input autoComplete="street-address" {...controlProps} {...register("address")} />}
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label={t("fields.deliveryDate")} error={errors.date?.message}>
                  {(controlProps) => <Input type="date" min={today} {...controlProps} {...register("date")} />}
                </Field>
                <Field label={t("fields.durationDays")} hint={t("fields.durationDaysHint")} error={errors.durationDays?.message}>
                  {(controlProps) => <Input type="number" inputMode="numeric" min={1} max={90} {...controlProps} {...register("durationDays")} />}
                </Field>
              </div>
            </>
          )}

          {type === "TRANSFER" && (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label={t("fields.passengerName")} error={errors.passengerName?.message}>
                  {(controlProps) => <Input autoComplete="off" {...controlProps} {...register("passengerName")} />}
                </Field>
                <Field label={t("fields.passengers")} hint={t("fields.passengersHint")} error={errors.passengers?.message}>
                  {(controlProps) => <Input type="number" inputMode="numeric" min={1} max={7} {...controlProps} {...register("passengers")} />}
                </Field>
              </div>
              <Field label={t("fields.flightNumber")} hint={t("fields.flightNumberHint")} error={errors.flightNumber?.message}>
                {(controlProps) => <Input autoComplete="off" autoCapitalize="characters" {...controlProps} {...register("flightNumber")} />}
              </Field>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-label text-fg">{t("fields.meetingPlace")}</legend>
                <div className="flex flex-wrap gap-x-6">
                  {(["airport", "address"] as const).map((kind) => (
                    <label key={kind} className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input type="radio" value={kind} className="size-5 shrink-0" {...register("meetingKind")} />
                      <span className="text-body text-fg">{t(`fields.meetingKind.${kind}`)}</span>
                    </label>
                  ))}
                </div>
                {meetingKind === "airport" ? (
                  <Field label={t("fields.airport")} error={errors.airport?.message}>
                    {(controlProps) => (
                      <Select {...controlProps} {...register("airport")}>
                        <option value="">{t("fields.airportChoose")}</option>
                        {AIRPORTS.map((code) => (
                          <option key={code} value={code}>
                            {t(`airports.${code}`)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ) : (
                  <Field label={t("fields.meetingAddress")} error={errors.address?.message}>
                    {(controlProps) => <Input autoComplete="street-address" {...controlProps} {...register("address")} />}
                  </Field>
                )}
              </fieldset>
              <Field label={t("fields.meetingAt")} hint={t("fields.meetingAtHint")} error={errors.meetingAt?.message}>
                {(controlProps) => <Input type="datetime-local" {...controlProps} {...register("meetingAt")} />}
              </Field>
              <Field label={t("fields.destination")} error={errors.destination?.message}>
                {(controlProps) => <Input autoComplete="off" {...controlProps} {...register("destination")} />}
              </Field>
              <Field label={t("fields.note")} hint={t("fields.noteHint")} error={errors.note?.message}>
                {(controlProps) => <Textarea rows={3} {...controlProps} {...register("note")} />}
              </Field>
            </>
          )}

          {type === "MAINTENANCE" && (
            <>
              <Field label={t("fields.service")} error={errors.service?.message}>
                {(controlProps) => (
                  <Select {...controlProps} {...register("service")}>
                    <option value="">{t("fields.serviceChoose")}</option>
                    {MAINTENANCE_SERVICES.map((service) => (
                      <option key={service} value={service}>
                        {t(`services.${service}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t("fields.preferredDate")} error={errors.preferredDate?.message}>
                {(controlProps) => <Input type="date" min={today} {...controlProps} {...register("preferredDate")} />}
              </Field>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded-control border-border-strong" {...register("valet")} />
                <span className="text-body text-fg">{t("fields.valet")}</span>
              </label>
              <Field label={valet ? t("fields.pickupAddress") : t("fields.pickupAddressOptional")} hint={valet ? undefined : t("fields.pickupHint")} error={errors.address?.message}>
                {(controlProps) => <Input autoComplete="street-address" {...controlProps} {...register("address")} />}
              </Field>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? t("sending") : t("send")}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/filom/talepler">{t("back")}</Link>
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
