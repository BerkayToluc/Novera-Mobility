import { getTranslations } from "next-intl/server";
import { PARTNERS } from "@/lib/partners";
import { PartnerLogo } from "./partner-logo";

// The partner strip (SPEC §2.2.4, after the Framer InfiniteLogoMarquee): logos muted until pointed
// at, and a strip that does not move by itself. It drifts left while the pointer is over it or
// keyboard focus is inside it, and stays where it stopped when that ends. Nothing starts without
// the visitor, so no pause button is needed (WCAG 2.2.2); with reduced motion it never moves.
// On a touch screen the strip scrolls sideways with a finger. The list is read once; the copy
// that closes the loop is hidden.
export async function PartnerStrip() {
  const t = await getTranslations("Partners");

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
      <header className="flex max-w-2xl flex-col gap-3">
        <h2 id="partners-title" className="text-h2 text-fg">
          {t("title")}
        </h2>
        <p className="text-body text-fg-muted">{t("intro")}</p>
      </header>

      {/* Edges fade so logos arrive and leave rather than being cut off by the container. The strip
          takes focus so a keyboard visitor can start it too, and scrolls sideways under a finger. */}
      <div
        tabIndex={0}
        role="group"
        aria-label={t("label")}
        className="group overflow-x-auto rounded-control [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <div className="flex w-max animate-marquee [animation-play-state:paused] group-focus-within:[animation-play-state:running] group-hover:[animation-play-state:running] motion-reduce:animate-none">
          {logos("first")}
          {logos("loop")}
        </div>
      </div>
    </section>
  );
}
