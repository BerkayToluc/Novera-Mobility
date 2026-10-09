import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { messages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  // Server Components rendered without an explicit locale read it from the
  // `[locale]` root segment, so pages never have to pass it down.
  const resolved = locale ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, resolved)) notFound();

  return {
    locale: resolved,
    messages: messages[resolved],
  };
});
