import type { routing } from "@/i18n/routing";

// Each language is named in its own language so a visitor who cannot read the current one still recognises theirs.
// These names are deliberately not translated. One map for the language switchers and the settings form (V2-14, M-07).
export const LANGUAGE_NAMES = {
  tr: "Türkçe",
  en: "English",
} as const satisfies Record<(typeof routing.locales)[number], string>;

export type LanguageCode = keyof typeof LANGUAGE_NAMES;
