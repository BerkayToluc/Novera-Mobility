"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PARTNERS } from "@/lib/partners";
import { PartnerLogo } from "./partner-logo";

// The partner strip (SPEC §2.2.4, after the Framer InfiniteLogoMarquee): logos drift left in a
// loop, muted until pointed at. It stops on hover, by its own button (WCAG 2.2.2: moving content
// that lasts over five seconds needs a way to pause it that works without a mouse) and, with
// reduced motion, never starts. The list is read once; the copy that closes the loop is hidden.
export function PartnerStrip() {
  const t = useTranslations("Partners");
  const [paused, setPaused] = useState(false);

  const logos = (copy: "first" | "loop") => (
    <ul
      aria-hidden={copy === "loop" ? true : undefined}
      // Each set carries its own trailing gap, so the two halves are exactly equal in width.
      className="flex shrink-0 items-center gap-12 pr-12 md:gap-16 md:pr-16"
    >
      {PARTNERS.map((partner) => (
        <li
          key={partner.id}
          className="text-fg-subtle transition-[color,transform] duration-200 hover:scale-105 hover:text-fg motion-reduce:transition-none"
        >
          <PartnerLogo partner={partner} />
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-labelledby="partners-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <header className="flex max-w-2xl flex-col gap-3">
          <h2 id="partners-title" className="text-h2 text-fg">
            {t("title")}
          </h2>
          <p className="text-body text-fg-muted">{t("intro")}</p>
        </header>
        {/* Nothing moves with reduced motion, so there is nothing to pause. */}
        <Button
          variant="outline"
          size="compact"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          className="self-start motion-reduce:hidden md:self-auto"
        >
          {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
          {paused ? t("play") : t("pause")}
        </Button>
      </div>

      {/* Edges fade so logos arrive and leave rather than being cut off by the container. */}
      <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <div
          className={cn(
            "flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none",
            paused && "[animation-play-state:paused]",
          )}
        >
          {logos("first")}
          {logos("loop")}
        </div>
      </div>
    </section>
  );
}
