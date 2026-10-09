"use client";

import { useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Field } from "@/components/ui/field";
import { TimeSelect } from "@/components/ui/time-select";
import { useRouter } from "@/i18n/navigation";
import type { BranchOption } from "@/lib/branch-options";
import { toQuery, type RentalSearch } from "@/lib/rental-search";
import {
  DEFAULT_TIME,
  fromRentalSearch,
  rentalSearchSchema,
  toRentalSearch,
  type RentalSearchInput,
} from "@/lib/rental-search-schema";
import { BranchSelect } from "./branch-select";

type RentalSearchFormProps = {
  branches: BranchOption[];
  // A search already made (the results page): the form starts as the visitor left it.
  initial?: RentalSearch;
};

// No dates yet: the visitor has not picked a range, which is what the schema then asks for.
const EMPTY = {
  pickupBranchId: "",
  returnBranchId: "",
  pickupTime: DEFAULT_TIME,
  returnTime: DEFAULT_TIME,
};

export function RentalSearchForm({ branches, initial }: RentalSearchFormProps) {
  const t = useTranslations("RentalSearch");
  const router = useRouter();

  const schema = useMemo(
    () =>
      rentalSearchSchema({
        pickupBranch: t("errors.pickupBranch"),
        returnBranch: t("errors.returnBranch"),
        dates: t("errors.dates"),
        order: t("errors.order"),
      }),
    [t],
  );

  const defaultValues = initial ? fromRentalSearch(initial) : EMPTY;
  const { control, handleSubmit, setValue, formState } = useForm<RentalSearchInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues,
  });

  // The return branch follows the pick-up branch until the visitor picks one themselves:
  // most rentals end where they began. A search that already returns elsewhere counts as chosen.
  const returnChosen = useRef(
    Boolean(initial && initial.returnBranchId !== initial.pickupBranchId),
  );

  function onSubmit(values: RentalSearchInput) {
    router.push({ pathname: "/araclar", query: toQuery(toRentalSearch(values)) });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 md:grid-cols-2">
      <Controller
        control={control}
        name="pickupBranchId"
        render={({ field, fieldState }) => (
          <Field label={t("pickupBranch")} error={fieldState.error?.message}>
            {({ id, ...props }, { labelId }) => (
              <BranchSelect
                id={id}
                labelledBy={labelId}
                ref={field.ref}
                options={branches}
                value={field.value}
                onChange={(branchId) => {
                  field.onChange(branchId);
                  if (!returnChosen.current) {
                    setValue("returnBranchId", branchId, { shouldValidate: formState.isSubmitted });
                  }
                }}
                {...props}
              />
            )}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="returnBranchId"
        render={({ field, fieldState }) => (
          <Field label={t("returnBranch")} error={fieldState.error?.message}>
            {({ id, ...props }, { labelId }) => (
              <BranchSelect
                id={id}
                labelledBy={labelId}
                ref={field.ref}
                options={branches}
                value={field.value}
                onChange={(branchId) => {
                  returnChosen.current = true;
                  field.onChange(branchId);
                }}
                {...props}
              />
            )}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="range"
        render={({ field, fieldState }) => (
          <Field label={t("dates")} error={fieldState.error?.message} className="md:col-span-2">
            {({ id, ...props }, { labelId }) => (
              <DateRangePicker
                id={id}
                labelledBy={labelId}
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                {...props}
              />
            )}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="pickupTime"
        render={({ field }) => (
          <Field label={t("pickupTime")}>
            {(props) => <TimeSelect {...props} ref={field.ref} value={field.value} onChange={field.onChange} />}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="returnTime"
        render={({ field }) => (
          <Field label={t("returnTime")}>
            {(props) => <TimeSelect {...props} ref={field.ref} value={field.value} onChange={field.onChange} />}
          </Field>
        )}
      />

      <Button type="submit" size="lg" className="md:col-span-2">
        {t("submit")}
      </Button>
    </form>
  );
}
