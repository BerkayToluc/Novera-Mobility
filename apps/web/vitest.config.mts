import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Unit tests (ARCHITECTURE ADR-11): plain functions and schemas, in Node. Components and flows
// are for the end-to-end tests (Playwright), not here.
export default defineConfig({
  resolve: {
    alias: {
      "@": root("."),
      // `server-only` throws outside a Next server build; tests are not one.
      "server-only": root("tests/stubs/server-only.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
