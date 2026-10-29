"use client";

import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { ADDRESS } from "@/lib/admin-query";
import type { AdminPath } from "./types";

type Props = {
  pathname: AdminPath;
  // The address as it is now (filters, sort, search); the page is dropped, because a new filter starts from page 1.
  query: Record<string, string>;
  // The name of the filter in the address (`bayi`) and what it is now.
  name: string;
  value: string;
  label: string;
  allLabel: string;
  applyLabel: string;
  options: Array<{ value: string; label: string }>;
};

// A filter of a list that is a choice among many (the cars of one model or branch): a form with a choice and a button, not a
// choice that acts by itself, so a keyboard user can move through the options without the page changing under them. The choice
// goes in the address, so it can be shared. (The city filter of the branches is the same, with the cities as its options.)
export function SelectFilter({ pathname, query, name, value, label, allLabel, applyLabel, options }: Props) {
  const router = useRouter();
  const id = useId();
  const rest = Object.fromEntries(Object.entries(query).filter(([key]) => key !== ADDRESS.page && key !== name));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = String(new FormData(event.currentTarget).get(name) ?? "");
    router.push({ pathname, query: chosen ? { ...rest, [name]: chosen } : rest });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/* Keyed by the value in the address, so a choice made elsewhere (back, a shared link) shows in the box. */}
      <div key={value} className="min-w-0 flex-1 md:max-w-xs">
        <Select id={id} name={name} defaultValue={value}>
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="outline">
        {applyLabel}
      </Button>
    </form>
  );
}
