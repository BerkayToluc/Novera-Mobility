import "server-only";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import type { Audience } from "./audience";
import { ApiUnavailableError } from "./fleet-client";
import type { FaqItem } from "./faq";
import { isMockMode } from "./mode";

// `GET /faq?audience=`, in the order the API sends. With USE_MOCKS=1 the sample questions answer instead;
// a failure throws, and the page shows its error state instead of invented answers.
export async function getFaq(audience: Audience): Promise<FaqItem[]> {
  if (isMockMode()) return (await import("@/mocks/faq")).mockFaq(audience);
  const query = audience === "kurumsal" ? "CORPORATE" : "INDIVIDUAL";
  const result = await apiRequest<components["schemas"]["FaqItem"][]>("GET", `/faq?audience=${query}`);
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data.map((item) => ({ id: item.id, audience, topic: "genel", question: item.question, answer: item.answer }));
}
