// Shared look of one choice in the language and theme switchers.
// "band" is for the dark footer, where the default link colour has too little contrast.
export type SwitcherTone = "default" | "band";

export function switcherItemClasses(isCurrent: boolean, tone: SwitcherTone) {
  const base = "inline-flex min-h-11 items-center rounded-control px-3 text-label";
  if (tone === "band") {
    // Inverted pill: it stays clearly visible on the band in both themes.
    return `${base} ${isCurrent ? "bg-on-band text-band" : "text-on-band hover:underline"}`;
  }
  return `${base} ${isCurrent ? "bg-selected text-on-selected" : "text-link hover:underline"}`;
}
