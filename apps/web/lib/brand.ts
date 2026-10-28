// The few places a colour has to be written as a value and cannot be a design token: the web
// manifest, the browser's `theme-color` and the generated icon and share images, which are read outside the page and
// its CSS. Each
// is a value from SPEC §5.1, so a change of palette starts there.
export const BRAND_COLORS = {
  // Olive 700, the brand colour: the address bar and the installed app's title bar.
  brand: "#45561d",
  // What is drawn on the brand colour: the logo mark of the app icon (white).
  onBrand: "#ffffff",
  // The light page background (white) and the dark one (SPEC §5.1).
  canvasLight: "#ffffff",
  canvasDark: "#13140f",
} as const;
