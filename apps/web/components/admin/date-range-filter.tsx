"use client";

import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { ADDRESS } from "@/lib/admin-query";
import type { AdminPath } from "./types";

type Props = {
  pathname: AdminPath;
  // The address as it is now (filters, sort, search); the page is dropped, because a new filter starts from page 1.
  query: Record<string, string>;
  // The names of the two filters in the address (`bas`, `bit`) and what they are now ("2026-10-30" or empty).
  fromName: string;
  toName: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  applyLabel: string;
  clearLabel: string;
};

// The days a list is narrowed to: two date fields and a button, not fields that act by themselves, so a keyboard user can type a
// whole date without the page changing under them. The days go in the address, so the result can be shared. Both days are
// included, and the browser's own date field makes a day that is not a day impossible to type.
export function DateRangeFilter({ pathname, query, fromName, toName, from, to, fromLabel, toLabel, applyLabel, clearLabel }: Props) {
  const router = useRouter();
  const fromId = useId();
  const toId = useId();
  const rest = Object.fromEntries(Object.entries(query).filter(([key]) => key !== ADDRESS.page && key !== fromName && key !== toName));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const first = String(data.get(fromName) ?? "");
    const last = String(data.get(toName) ?? "");
    router.push({ pathname, query: { ...rest, ...(first ? { [fromName]: first } : {}), ...(last ? { [toName]: last } : {}) } });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      {/* Keyed by the days in the address, so a choice made elsewhere (back, a shared link) shows in the fields. */}
      <div key={`${from}|${to}`} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={fromId} className="text-label text-fg">
            {fromLabel}
          </label>
          <Input id={fromId} name={fromName} type="date" defaultValue={from} max={to || undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={toId} className="text-label text-fg">
            {toLabel}
          </label>
          <Input id={toId} name={toName} type="date" defaultValue={to} min={from || undefined} />
        </div>
      </div>
      <Button type="submit" variant="outline">
        {applyLabel}
      </Button>
      {(from || to) && (
        <Button type="button" variant="ghost" onClick={() => router.push({ pathname, query: rest })}>
          {clearLabel}
        </Button>
      )}
    </form>
  );
}
