import { getLocale, getTranslations } from "next-intl/server";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { StateMessage } from "@/components/ui/state-message";
import type { Audience } from "@/lib/audience";
import { getFaq } from "@/lib/faq-client";
import type { FaqItem } from "@/lib/faq";

export async function FaqSection({ audience }: { audience: Audience }) {
  const t = await getTranslations("HomePage.faq");
  const locale = (await getLocale()) as "tr" | "en";

  // Only the fetch sits in the try, so a rendering bug still reaches the error boundary.
  let items: FaqItem[] | null;
  try {
    items = await getFaq(audience);
  } catch {
    items = null;
  }

  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-6">
      <h2 id="faq-title" className="text-h2 text-fg">
        {t("title")}
      </h2>
      {items === null ? (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")} />
      ) : items.length === 0 ? (
        <StateMessage title={t("empty.title")} text={t("empty.text")} />
      ) : (
        <Accordion className="max-w-3xl">
          {items.map((item) => (
            <AccordionItem key={item.id} name="home-faq" title={item.question[locale]}>
              {item.answer[locale]}
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}
