import { describe, expectTypeOf, it } from "vitest";
import type { components } from "@/lib/api-types";
import type { Currency, Money } from "@/lib/currency";
import type { LocalizedText } from "@/lib/vehicle";

type Schemas = components["schemas"];

// The pieces of the interim types that must be the contract's own (docs/api/openapi.yaml, generated
// into lib/api-types.ts by `pnpm --filter @novera/web gen:api`). These are checked by the compiler:
// if the contract changes one of them, `pnpm typecheck` fails here. Where the interim types
// differ on purpose, the list is in docs/API-GAPS.md.
describe("shared shapes match the contract", () => {
  it("currency, money and localized text", () => {
    expectTypeOf<Currency>().toEqualTypeOf<Schemas["Currency"]>();
    expectTypeOf<Money>().toEqualTypeOf<Schemas["Money"]>();
    expectTypeOf<LocalizedText>().toEqualTypeOf<Schemas["LocalizedText"]>();
  });
});
