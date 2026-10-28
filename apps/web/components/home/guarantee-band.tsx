import type { CSSProperties } from "react";
import { ArrowRight, Check, Headset, KeyRound, Siren, TriangleAlert, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { SplitText, splitTextGroup } from "@/components/ui/split-text";
import { StepProgress } from "./step-progress";

const STEPS = [
  { key: "stranded", icon: TriangleAlert },
  { key: "sos", icon: Siren },
  { key: "tow", icon: Truck },
  { key: "desk", icon: Headset },
  { key: "replacement", icon: KeyRound },
] as const;

// One step every second: the line to the next stop takes 0.8 s, the stop turns as it arrives, so
// the five fill in a little over four seconds. Unfilled (armed) nothing transitions, so the
// reset on load is instant. The delays read the step's --i.
function stepDelay(part: "line" | "stop") {
  return part === "line"
    ? "[transition-delay:calc(var(--i)*1s+0.3s)] group-data-[armed]/sp:transition-none"
    : "[transition-delay:calc(var(--i)*1s+0.05s)] group-data-[armed]/sp:transition-none";
}

// The one dark band on the page (SPEC §5.4, §5.5): the Road Assurance promise told as five stops
// along one line, filled in order when the band comes into view (StepProgress). Left to right from
// xl up, top to bottom below it.
export async function GuaranteeBand() {
  const t = await getTranslations("Guarantee");

  return (
    <section id="yol-boyu-guvence" aria-labelledby="guarantee-title" className="scroll-mt-4 bg-band text-on-band">
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
            className={cn("group inline-flex min-h-11 shrink-0 items-center gap-2 self-start text-label text-band-accent md:self-auto", splitTextGroup)}
          >
            <SplitText text={t("cta")} />
            <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <StepProgress>
          <ol className="relative grid gap-10 xl:grid-cols-5 xl:gap-6">
            {STEPS.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                style={{ "--i": index } as CSSProperties}
                className="relative flex gap-5 xl:flex-col xl:items-center xl:text-center"
              >
                {/* The stretch of line to the next stop: down to it on a phone and tablet, across to
                    it from xl up. The fill grows along it, then the next stop turns. */}
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-16 left-6 top-6 w-1 -translate-x-1/2 rounded-full bg-on-band/20 xl:bottom-auto xl:left-1/2 xl:h-1 xl:w-step-line xl:translate-x-0 xl:-translate-y-1/2"
                  >
                    <span className={cn("block size-full origin-top rounded-full bg-band-accent transition-[scale] duration-800 ease-step xl:origin-left", stepDelay("line"), "group-data-[armed]/sp:scale-y-0 xl:group-data-[armed]/sp:scale-x-0 xl:group-data-[armed]/sp:scale-y-100")} />
                  </span>
                )}
                <span
                  className={cn(
                    "relative z-10 inline-flex size-12 shrink-0 items-center justify-center rounded-control border-2 border-band-accent bg-band-accent text-band transition-colors duration-300",
                    stepDelay("stop"),
                    "group-data-[armed]/sp:border-on-band/30 group-data-[armed]/sp:bg-band group-data-[armed]/sp:text-band-accent",
                  )}
                >
                  <Icon aria-hidden="true" className={cn("absolute size-5 scale-90 opacity-0 blur-xs transition-[opacity,scale,filter] duration-300", stepDelay("stop"), "group-data-[armed]/sp:scale-100 group-data-[armed]/sp:opacity-100 group-data-[armed]/sp:blur-none")} />
                  <Check aria-hidden="true" className={cn("absolute size-5 transition-[opacity,scale,filter] duration-300", stepDelay("stop"), "group-data-[armed]/sp:scale-90 group-data-[armed]/sp:opacity-0 group-data-[armed]/sp:blur-xs")} />
                </span>
                <div className="flex flex-col gap-1 pt-1 xl:pt-0">
                  <span aria-hidden="true" className="text-small tabular-nums text-on-band/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="sr-only">{index + 1}.</span>
                  <h3 className="text-h3">{t(`steps.${key}.title`)}</h3>
                  <p className="max-w-xs text-body text-on-band/80">{t(`steps.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </StepProgress>
      </div>
    </section>
  );
}
