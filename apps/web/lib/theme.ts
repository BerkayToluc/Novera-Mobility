export const THEME_COOKIE = "novera-theme";
// A year: a visitor's choice should outlive a normal browsing gap.
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// "system" follows the operating system; it is a choice, not the starting point.
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

// The site opens light (white) until the visitor picks otherwise (G's decision, SPEC §5.1).
export const DEFAULT_THEME: Theme = "light";

// A missing or unknown value falls back to the default, so a tampered cookie can
// never put an arbitrary string into the <html> attribute.
export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? DEFAULT_THEME;
}

// What the browser should assume before CSS loads: a fixed scheme, or both for "system".
export function colorSchemeOf(theme: Theme): "light" | "dark" | "light dark" {
  return theme === "system" ? "light dark" : theme;
}
