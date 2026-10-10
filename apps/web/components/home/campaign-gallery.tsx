"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type CampaignSlide = {
  id: string;
  title: string;
  text: string;
  cta: string;
  href: ComponentProps<typeof Link>["href"];
  art: ReactNode;
};

// The campaign gallery at the top of the home page (SPEC §2.2.1). The slides sit in a native
// scroll-snap strip, so touch swipe, trackpad and keyboard scrolling work without script; the
// arrows and dots only move that strip. Nothing advances on its own: the visitor sets the pace.
export function CampaignGallery({ slides }: { slides: CampaignSlide[] }) {
  const t = useTranslations("HomePage.gallery");
  const stripRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  // Where the strip is headed. Scroll events arrive a frame late and keep firing while a
  // smooth scroll runs, so the arrows count from the target, not from the scroll position.
  const targetRef = useRef(0);
  const settlingUntilRef = useRef(0);

  // `at` is the triggering event's timeStamp, the same clock the scroll events carry.
  function go(index: number, at: number) {
    const strip = stripRef.current;
    if (!strip) return;
    const target = (index + slides.length) % slides.length;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targetRef.current = target;
    settlingUntilRef.current = at + (reduce ? 0 : 700);
    setCurrent(target);
    strip.scrollTo({ left: target * strip.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section aria-roledescription={t("roledescription")} aria-label={t("label")} className="flex flex-col gap-4">
      <ul
        ref={stripRef}
        onScroll={(event) => {
          // Swipes and trackpads move the strip directly; follow them once a button's own
          // smooth scroll has settled, so its intermediate positions do not undo the target.
          if (event.timeStamp < settlingUntilRef.current) return;
          const strip = event.currentTarget;
          const index = Math.round(strip.scrollLeft / strip.clientWidth);
          targetRef.current = index;
          setCurrent(index);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-media [scrollbar-width:none]"
      >
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            role="group"
            aria-roledescription={t("slideRoledescription")}
            aria-label={t("slideLabel", { index: index + 1, total: slides.length })}
            className="grid w-full shrink-0 snap-start overflow-hidden bg-surface-muted md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
          >
            <div className="order-2 flex flex-col items-start justify-center gap-4 p-6 md:order-1 md:p-10 xl:p-14">
              {/* The page's h1 is the rental heading below (SPEC §2.2); campaigns are h2. */}
              <h2 className="text-h1 text-fg">{slide.title}</h2>
              <p className="max-w-md text-body text-fg-muted">{slide.text}</p>
              <Button asChild>
                <Link href={slide.href}>{slide.cta}</Link>
              </Button>
            </div>
            <div className="order-1 aspect-[16/10] md:order-2 md:aspect-auto md:min-h-80">
              {slide.art}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={(event) => go(index, event.timeStamp)}
              aria-label={t("goTo", { index: index + 1 })}
              aria-current={index === current ? "true" : undefined}
              // A 44px target around a small visual dot (WCAG 2.5.8).
              className="group inline-flex size-11 items-center justify-center rounded-full"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all",
                  index === current ? "w-6 bg-primary" : "w-2 bg-border-strong group-hover:bg-fg-muted",
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={(event) => go(targetRef.current - 1, event.timeStamp)} aria-label={t("previous")}>
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={(event) => go(targetRef.current + 1, event.timeStamp)} aria-label={t("next")}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
