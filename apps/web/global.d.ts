import type { routing } from "@/i18n/routing";
import type messages from "./messages/tr.json";

// Turkish is the reference file: a key used in code but missing from tr.json
// fails the typecheck instead of rendering the raw key on the page.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
