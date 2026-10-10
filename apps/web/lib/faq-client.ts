import "server-only";
import { mockFaq } from "@/mocks/faq";
import type { Audience } from "./audience";
import { ApiUnavailableError } from "./fleet-client";
import type { FaqItem } from "./faq";

// Same rule as fleet-client: without USE_MOCKS=1 and without an API, say so instead of
// showing invented answers. Becomes `GET ${API_URL}/faq?audience=` with BACKLOG #33.
export async function getFaq(audience: Audience): Promise<FaqItem[]> {
  if (process.env.USE_MOCKS === "1") return mockFaq(audience);
  throw new ApiUnavailableError();
}
