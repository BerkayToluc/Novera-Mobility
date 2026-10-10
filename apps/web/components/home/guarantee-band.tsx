import { getTranslations } from "next-intl/server";

const STEPS = ["stranded", "sos", "tow", "desk", "replacement"] as const;

// The one dark band on the page (SPEC §5.4): the Road Assurance promise told as a single
// sequence, top to bottom on a phone and left to right from the desktop width up.
export async function GuaranteeBand() {
  const t = await getTranslations("Guarantee");

  return (
    <section aria-labelledby="guarantee-title" className="bg-band text-on-band">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-20">
        <header className="flex flex-col gap-3">
          <h2 id="guarantee-title" className="max-w-3xl text-h1">
            {t("title")}
          </h2>
          <p className="max-w-prose text-body">{t("intro")}</p>
        </header>
        <ol className="flex flex-col gap-6 xl:grid xl:grid-cols-5 xl:gap-4">
          {STEPS.map((step, index) => (
            <li
              key={step}
              // The rule is the time line: a left edge on a phone, a top edge on desktop.
              className="flex flex-col gap-1 border-l-2 border-on-band pl-4 xl:border-l-0 xl:border-t-2 xl:pl-0 xl:pt-4"
            >
              <span className="sr-only">{index + 1}.</span>
              <h3 className="text-h3">{t(`steps.${step}.title`)}</h3>
              <p className="text-body">{t(`steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
