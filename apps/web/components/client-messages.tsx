import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { CLIENT_NAMESPACES } from "@/i18n/client-messages";
import { pickNamespaces } from "@/i18n/pick-namespaces";

// Gives the client components below only the text they use (V2-15, QUALITY P-01; the list is i18n/client-messages.ts).
// A layout or page wraps what it renders in this; the root layout does the same for the header and the banner.
export async function ClientMessages({ route, children }: { route: keyof typeof CLIENT_NAMESPACES; children: ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={pickNamespaces(messages, CLIENT_NAMESPACES[route])}>{children}</NextIntlClientProvider>;
}
