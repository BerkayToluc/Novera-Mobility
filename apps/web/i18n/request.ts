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
    // Every rental happens in Turkey (one time zone, no daylight saving). Without this,
    // next-intl formats dates in the server's own zone, so one booking would read
    // differently on a laptop in Warsaw and on a server in UTC. The API sends UTC instants
    // (ISO 8601); they are shown, and later entered, in this zone.
    timeZone: "Europe/Istanbul",
  };
});
