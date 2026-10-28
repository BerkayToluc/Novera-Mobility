// Which message namespaces each part of the site sends to the browser (V2-15, QUALITY P-01). Without `messages` the
// provider sent every namespace of both files to every page; now the root layout sends what the header, the consent
// banner and the error page use, and a page wraps its own client components in <ClientMessages route="...">, which sends
// only what they use. Server components resolve their text on the server and need nothing here.
//
// tests/client-messages.test.ts reads the code and fails when this list and the `useTranslations` calls of the
// client components a page renders stop agreeing, so a new client component cannot silently miss its text.
// Panel (admin) and fleet-panel text will be loaded the same way, only on their own routes (V2-24).

/** What every page needs: the header, the consent banner and the error page (layout.tsx and error.tsx). */
export const ROOT_NAMESPACES: readonly string[] = ["Consent", "CurrencySwitcher", "Header", "LocaleSwitcher", "ProductsPage", "ServerError"];

export const CLIENT_NAMESPACES = {
  "araclar/layout": ["DateRangePicker", "RentalSearch", "ResultsPage", "Vehicle"],
  "bayilerimiz/layout": ["BranchesPage", "ContactLink", "RentalSearch"],
  "dev/layout": ["Auth", "ContactLink", "DateRangePicker", "DevGallery", "Profile", "RateLimit", "ThemeSwitcher"],
  "giris/layout": ["Auth", "RateLimit"],
  "hakkimizda/layout": ["AboutPage"],
  "hizmetler/layout": ["ContactLink"],
  "iletisim/layout": ["ContactForm", "ContactLink", "FormParts", "RateLimit"],
  "kayit/layout": ["Auth", "RateLimit"],
  "kurumsal-teklif/layout": ["FormParts", "ProductsPage", "QuoteForm", "RateLimit"],
  "odeme/layout": ["Driver", "HoldCountdown", "Payment", "RateLimit"],
  page: ["DateRangePicker", "FleetPage", "FormParts", "GuidesPage", "HomePage", "ProductsPage", "QuoteForm", "RateLimit", "RentalSearch", "Vehicle"],
  "profil/layout": ["Auth", "ContactLink", "Profile", "RateLimit", "ThemeSwitcher"],
  "rezervasyon/layout": ["BookingSummary", "HoldCountdown", "Payment", "ResultsPage"],
  "sifre-sifirla/layout": ["Auth", "RateLimit"],
  "yardim/layout": ["HelpPage"],
} as const satisfies Record<string, readonly string[]>;
