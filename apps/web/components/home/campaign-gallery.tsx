"use client";

import { useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
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
// The arrows sit inside the picture, a frosted band down its left and right edge (SPEC §2.2.1,
// G): on a device that hovers they appear when the pointer is over the gallery or an arrow has
// focus; on a touch screen, which cannot hover, they stay in view.
export function CampaignGallery({ slides }: { slides: CampaignSlide[] }) {
  const t = useTranslations("HomePage.gallery");
  const stripRef = useRef<HTMLDivElement>(null);
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
      <div className="group/gallery relative">
      <div
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
          <div
            key={slide.id}
            role="group"
            aria-roledescription={t("slideRoledescription")}
            aria-label={t("slideLabel", { index: index + 1, total: slides.length })}
            className="grid w-full shrink-0 snap-start overflow-hidden bg-surface-muted md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
          >
            <div className="order-2 flex flex-col items-start justify-center gap-4 p-6 md:order-1 md:p-10 md:pl-24 xl:p-14 xl:pl-28">
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
          </div>
        ))}
      </div>
      {/* Laid over the strip: the bands run down the card's own left and right edge (G), over the
          picture on a phone, where it is the top of the card, and the whole height from md up. The
          text column keeps room for the left band (its padding below). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/10] overflow-hidden rounded-t-media md:inset-y-0 md:aspect-auto md:rounded-media">
        <GalleryArrow side="previous" label={t("previous")} onClick={(event) => go(targetRef.current - 1, event.timeStamp)} />
        <GalleryArrow side="next" label={t("next")} onClick={(event) => go(targetRef.current + 1, event.timeStamp)} />
      </div>
      </div>

      <div className="flex items-center gap-4">
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
      </div>
    </section>
  );
}

// One edge of the picture: the whole height is the button (a large target), frosted so the art
// behind stays readable, with the chevron on a solid disc so it keeps its contrast on any slide.
function GalleryArrow({
  side,
  label,
  onClick,
}: {
  side: "previous" | "next";
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const Icon = side === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "pointer-events-auto absolute inset-y-0 flex w-14 items-center justify-center bg-surface/25 backdrop-blur-md transition-opacity duration-300 md:w-20",
        "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/gallery:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100",
        "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus motion-reduce:transition-none",
        side === "previous" ? "left-0" : "right-0",
      )}
    >
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-fg shadow-overlay">
        <Icon aria-hidden="true" className="size-5" />
      </span>
    </button>
  );
}
