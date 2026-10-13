"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A footer block that eases into view when the page scrolls to it (after the Framer Simple
// Footer): "block" grows from a touch smaller, "text" rises into place. Neither fades: see globals.css. The server's page shows
// everything; once in the browser, a block that is below the fold is hidden and shown again when
// it is a third in view, once. Nothing is hidden with reduced motion or for a block that is
// already on screen, and the transition itself is in globals.css.
export function FooterReveal({
  kind,
  className,
  children,
}: {
  kind: "block" | "text";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete element.dataset.reveal;
    };
  }, []);

  return (
    <div ref={ref} data-kind={kind} className={className}>
      {children}
    </div>
  );
}
