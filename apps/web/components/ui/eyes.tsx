"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

// Two eyes whose pupils follow the pointer (after the Framer "eyes" component): each eye is a
// 24 by 36 capsule with a 16 by 22 pupil and a small highlight. Every so often both blink. The
// pupils move by their own room inside the eye, so they stay in it; how far depends on how far the
// pointer is, so a pointer right beside the eye does not push them to the edge. Decorative.
// With reduced motion they look straight ahead and never blink; a finger on a touch screen leads
// them while it is down.

const PUPIL_ROOM = { x: 4, y: 7 }; // (eye 24 - pupil 16) / 2 and (36 - 22) / 2
const REACH_PX = 120; // how far away the pointer still pushes the pupil all the way

export function Eyes({ className }: { className?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const eyes = [...root.querySelectorAll<HTMLElement>("[data-eye]")];
    const pupils = eyes.map((eye) => eye.querySelector<HTMLElement>("[data-pupil]")!);
    const current = pupils.map(() => ({ x: 0, y: 0 }));
    const target = pupils.map(() => ({ x: 0, y: 0 }));
    let frame = 0;

    function aim(clientX: number, clientY: number) {
      eyes.forEach((eye, index) => {
        const rect = eye.getBoundingClientRect();
        const dx = clientX - (rect.left + rect.width / 2);
        const dy = clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, distance / REACH_PX);
        target[index] = { x: (dx / distance) * PUPIL_ROOM.x * pull, y: (dy / distance) * PUPIL_ROOM.y * pull };
      });
      if (!frame) frame = requestAnimationFrame(step);
    }

    // The pupils ease toward the target rather than jumping to it.
    function step() {
      let moving = false;
      pupils.forEach((pupil, index) => {
        const c = current[index];
        const t = target[index];
        c.x += (t.x - c.x) * 0.2;
        c.y += (t.y - c.y) * 0.2;
        if (Math.abs(t.x - c.x) > 0.02 || Math.abs(t.y - c.y) > 0.02) moving = true;
        pupil.style.transform = `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px)`;
      });
      frame = moving ? requestAnimationFrame(step) : 0;
    }

    const onMove = (event: PointerEvent) => aim(event.clientX, event.clientY);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });

    // A blink every few seconds, a little different each time.
    let blinkTimer: ReturnType<typeof setTimeout>;
    function blink() {
      eyes.forEach((eye) => eye.setAttribute("data-blink", ""));
      setTimeout(() => eyes.forEach((eye) => eye.removeAttribute("data-blink")), 140);
      blinkTimer = setTimeout(blink, 3000 + Math.random() * 4000);
    }
    blinkTimer = setTimeout(blink, 2500);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      clearTimeout(blinkTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span ref={rootRef} aria-hidden="true" className={cn("relative inline-flex h-9 w-14 justify-between", className)}>
      {[0, 1].map((side) => (
        <span
          key={side}
          data-eye=""
          className="relative flex h-9 w-6 items-center justify-center overflow-hidden rounded-full bg-eye-white transition-transform duration-150 data-[blink]:scale-y-10"
        >
          <span data-pupil="" className="relative block h-5.5 w-4 rounded-full bg-eye-pupil will-change-transform">
            <span className="absolute bottom-0.75 left-1/2 size-0.75 -translate-x-1/2 rounded-full bg-eye-white" />
          </span>
        </span>
      ))}
    </span>
  );
}
