import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Tailwind arbitrary values like `bg-[#fff]` or `p-[13px]` bypass the design
// tokens in app/globals.css. The token layer already removes off-brand named
// classes, so this rule closes the remaining escape hatch.
const ARBITRARY_VALUE = String.raw`/\[(#|rgb|hsl|oklch|-?\d*\.?\d+(px|rem|em)\b)/`;
const tokenOnlyMessage =
  "Use a design token class instead of an arbitrary value (see app/globals.css and docs/SPEC.md §5).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "warn",
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
