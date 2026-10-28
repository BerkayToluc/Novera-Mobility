import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Tailwind arbitrary values like `bg-[#fff]`, `p-[13px]` or `w-[calc(100%-2rem)]` bypass the design
// tokens in app/globals.css. The token layer already removes off-brand named
// classes, so this rule closes the remaining escape hatch: any bracket that holds a colour, or a number with a
// length unit or a percentage, wherever it sits inside the brackets (V2-14, QUALITY M-08). A layout that needs a fixed
// size is named in globals.css (`@utility grid-cols-sidebar`) instead.
const ARBITRARY_VALUE = String.raw`/\[[^\]]*(#[0-9a-fA-F]{3,8}|[0-9](px|rem|em|vh|vw|dvh|svh|lvh|%)|(rgb|hsl|oklch)a?\()/`;
const tokenOnlyMessage =
  "Use a design token class instead of an arbitrary value (see app/globals.css and docs/SPEC.md §5).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=${ARBITRARY_VALUE}]`,
          message: tokenOnlyMessage,
        },
        {
          selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=${ARBITRARY_VALUE}]`,
          message: tokenOnlyMessage,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
