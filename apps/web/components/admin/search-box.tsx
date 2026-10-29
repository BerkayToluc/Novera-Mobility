"use client";

import { useId, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { ADDRESS } from "@/lib/admin-query";
import type { AdminPath } from "./types";

type Props = {
  pathname: AdminPath;
  // The address as it is now (filters, sort); the page is dropped, because a new search starts from page 1.
  query: Record<string, string>;
  value: string;
  // What the box is for ("Search bookings"); it names the search for assistive technology.
  label?: string;
};

// The search of a list: a form that puts the words in the address (`ara=`), so the result can be shared. It is a
// submit, not a search-as-you-type, which would send a request for every key.
export function SearchBox({ pathname, query, value, label }: Props) {
  const t = useTranslations("Admin.search");
  const router = useRouter();
  const id = useId();
  const rest = Object.fromEntries(Object.entries(query).filter(([key]) => key !== ADDRESS.page && key !== ADDRESS.search));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = String(new FormData(event.currentTarget).get(ADDRESS.search) ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
    router.push({ pathname, query: words ? { ...rest, [ADDRESS.search]: words } : rest });
  }

  return (
    <form role="search" onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label ?? t("label")}
      </label>
      {/* Keyed by the value in the address, so a search made elsewhere (the clear link, back) shows in the box. */}
      <Input id={id} key={value} name={ADDRESS.search} type="search" defaultValue={value} maxLength={100} className="min-w-0 flex-1 md:max-w-sm" />
      <Button type="submit" variant="outline">
        <Search aria-hidden="true" className="size-4" />
        {t("button")}
      </Button>
      {value && (
        <Button asChild variant="ghost">
          <Link href={{ pathname, query: rest }}>{t("clear")}</Link>
        </Button>
      )}
    </form>
  );
}
