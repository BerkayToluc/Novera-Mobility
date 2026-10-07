export const THEME_COOKIE = "novera-theme";
// A year: a visitor's choice should outlive a normal browsing gap.
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

// A missing or unknown value means "follow the system", so a tampered cookie can
// never put an arbitrary string into the <html> attribute.
export function parseTheme(value: string | undefined): Theme | undefined {
  return THEMES.find((theme) => theme === value);
}
