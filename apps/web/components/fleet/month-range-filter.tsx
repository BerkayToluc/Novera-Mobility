"use client";

import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

type Props = {
  // The page the months are for.
  pathname: "/filom/raporlar" | "/filom/yesil-filo";
  // The first month and the last ("2026-08") as they are now, the latest month that can be chosen, and the words.
  from: string;
  to: string;
  max: string;
  fromLabel: string;
  toLabel: string;
  applyLabel: string;
};

// The custom period of the report: two month fields and a button, not fields that act by themselves, so a keyboard user can type a whole
// month without the page changing under them. The months go in the address (`donem=ozel&bas=…&bit=…`), so the report can be shared.
export function MonthRangeFilter({ pathname, from, to, max, fromLabel, toLabel, applyLabel }: Props) {
  const router = useRouter();
  const fromId = useId();
  const toId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    router.push({ pathname, query: { donem: "ozel", bas: String(data.get("bas") ?? ""), bit: String(data.get("bit") ?? "") } });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      {/* Keyed by the months in the address, so a choice made elsewhere (back, a shared link) shows in the fields. */}
      <div key={`${from}|${to}`} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={fromId} className="text-label text-fg">
            {fromLabel}
          </label>
          <Input id={fromId} name="bas" type="month" defaultValue={from} max={max} required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={toId} className="text-label text-fg">
            {toLabel}
          </label>
          <Input id={toId} name="bit" type="month" defaultValue={to} max={max} required />
        </div>
      </div>
      <Button type="submit" variant="outline">
        {applyLabel}
      </Button>
    </form>
  );
}
