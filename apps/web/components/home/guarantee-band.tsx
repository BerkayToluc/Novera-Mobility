import { ArrowRight, Headset, KeyRound, Siren, TriangleAlert, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const STEPS = [
  { key: "stranded", icon: TriangleAlert },
  { key: "sos", icon: Siren },
  { key: "tow", icon: Truck },
  { key: "desk", icon: Headset },
  { key: "replacement", icon: KeyRound },
] as const;

// The one dark band on the page (SPEC §5.4, §5.5): the Road Assurance promise told as a single
// journey along a road, not as five equal boxes. The dashed line is the road's centre marking;
// each stop on it is one moment of the breakdown. Left to right from xl up, top to bottom below it.
export async function GuaranteeBand() {
  const t = await getTranslations("Guarantee");

  return (
    <section aria-labelledby="guarantee-title" className="bg-band text-on-band">
      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-16 md:px-8 xl:gap-16 xl:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <header className="flex max-w-2xl flex-col gap-4">
            <h2 id="guarantee-title" className="text-h1">
              {t("title")}
            </h2>
            <p className="max-w-prose text-body">{t("intro")}</p>
          </header>
          <Link
            href={{ pathname: "/hizmetler", query: { hizmet: "1" }, hash: "hizmet-1" }}
            className="group inline-flex min-h-11 shrink-0 items-center gap-2 self-start text-label text-band-accent hover:underline md:self-auto"
          >
            {t("cta")}
            <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="relative">
          {/* The road: vertical behind the markers below xl, horizontal from xl up. Outside the
              list, since an <ol> may only hold list items. */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-6 top-6 border-l-2 border-dashed border-on-band/40 xl:bottom-auto xl:right-6 xl:border-l-0 xl:border-t-2"
          />
          <ol className="relative grid gap-10 xl:grid-cols-5 xl:gap-6">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key} className="relative flex gap-5 xl:flex-col">
              <span className="relative z-10 inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-on-band/30 bg-band text-band-accent">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="flex flex-col gap-2 pt-2 xl:pt-0">
                <span className="sr-only">{index + 1}.</span>
                <h3 className="text-h3">{t(`steps.${key}.title`)}</h3>
                <p className="max-w-xs text-body text-on-band/80">{t(`steps.${key}.text`)}</p>
              </div>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
