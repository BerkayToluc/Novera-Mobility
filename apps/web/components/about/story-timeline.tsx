"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { StoryArt, type StoryArtKind } from "./story-art";

export type Milestone = { key: StoryArtKind; year: number; title: string; text: string };

// The wave the milestones sit on (SPEC §2.7, after the Framer "Oxbow" timeline). Drawn on a
// 1000 x 144 grid; the nodes are placed along the same curve, so the line and the dots always meet.
const WIDTH = 1000;
const HEIGHT = 144;
const wave = (x: number) => HEIGHT / 2 + 30 * Math.sin((x / WIDTH) * Math.PI * 3);
const WAVE_PATH = Array.from({ length: 101 }, (_, i) => {
  const x = (i / 100) * WIDTH;
  return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${wave(x).toFixed(1)}`;
}).join(" ");

// From md up: a wave with one node per year, and the chosen year's card opens beneath it.
// Below md: the same milestones as a plain vertical list, since a wave does not fit a phone.
export function StoryTimeline({ milestones }: { milestones: Milestone[] }) {
  const t = useTranslations("AboutPage.timelineNav");
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();
  const current = milestones[active];
  const nodeX = (index: number) => (WIDTH * (index + 0.5)) / milestones.length;

  function select(index: number, focus = false) {
    const next = (index + milestones.length) % milestones.length;
    setActive(next);
    if (focus) tabs.current[next]?.focus();
  }

  // The arrow keys move between years, as in any tab list; Home and End jump to the ends.
  function onKeyDown(event: KeyboardEvent) {
    const move: Record<string, number | undefined> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: milestones.length - 1,
    };
    const target = move[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target, true);
  }

  return (
    <>
      {/* Phone: every milestone, in order. */}
      <ol className="flex flex-col md:hidden">
        {milestones.map((item) => (
          <li key={item.key} className="flex flex-col gap-3 border-l-2 border-border py-5 pl-5">
            <p className="text-label tabular-nums text-link">{item.year}</p>
            <StoryArt kind={item.key} className="aspect-3/2 w-full rounded-media" />
            <h3 className="text-h3 text-fg">{item.title}</h3>
            <p className="max-w-prose text-body text-fg-muted">{item.text}</p>
          </li>
        ))}
      </ol>

      {/* md and up: the wave and one open card. */}
      <div className="hidden flex-col gap-8 md:flex">
        <div onKeyDown={onKeyDown} role="tablist" aria-label={t("label")} className="relative h-36">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
          >
            <defs>
              {/* The part of the wave already passed is drawn in the brand colour. */}
              <clipPath id={`${uid}-trail`}>
                <rect x="0" y="0" width={nodeX(active)} height={HEIGHT} />
              </clipPath>
            </defs>
            <path d={WAVE_PATH} fill="none" stroke="var(--color-border-strong)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path
              d={WAVE_PATH}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              clipPath={`url(#${uid}-trail)`}
            />
          </svg>
          {milestones.map((item, index) => {
            const selected = index === active;
            return (
              <button
                key={item.key}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${index}`}
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                aria-label={`${item.year}: ${item.title}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                style={{ left: `${(nodeX(index) / WIDTH) * 100}%`, top: `${(wave(nodeX(index)) / HEIGHT) * 100}%` }}
                className="group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block rounded-full border-2 transition-all duration-200",
                    selected
                      ? "size-6 border-primary bg-primary ring-4 ring-selected"
                      : index < active
                        ? "size-4 border-primary bg-surface group-hover:bg-selected"
                        : "size-4 border-border-strong bg-surface group-hover:border-primary",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-full mt-1 text-label tabular-nums",
                    selected ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {item.year}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${uid}-panel`}
          aria-labelledby={`${uid}-tab-${active}`}
          // Re-keyed per year so the card fades in again each time (off with reduced motion).
          key={current.key}
          className="grid items-center gap-6 rounded-card border border-border bg-surface-muted p-6 motion-safe:animate-fade-in md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10 md:p-8"
        >
          <StoryArt kind={current.key} className="aspect-3/2 w-full rounded-media" />
          <div className="flex flex-col gap-4">
            <p className="text-display tabular-nums text-link">{current.year}</p>
            <h3 className="text-h2 text-fg">{current.title}</h3>
            <p className="max-w-prose text-body text-fg-muted">{current.text}</p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => select(active - 1)} aria-label={t("previous")}>
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => select(active + 1)} aria-label={t("next")}>
                <ChevronRight aria-hidden="true" className="size-5" />
              </Button>
              <p className="ml-2 text-small tabular-nums text-fg-muted" aria-hidden="true">
                {active + 1} / {milestones.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
