import type { routing } from "@/i18n/routing";
import type { tr } from "./i18n/messages";

// Turkish is the reference: a key used in code but missing from messages/tr/ fails the
// typecheck instead of rendering the raw key on the page.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof tr;
  }
}
