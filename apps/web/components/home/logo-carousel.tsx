"use client";

import { useEffect, useRef, type ReactNode } from "react";

// The partner strip's motion (SPEC §2.2.4, after the Framer "Logo 3D Carousel"): the logos drift
// left on their own and swell as they pass the middle, as if on a drum, shrinking, fading a little
// and blurring towards the edges. Pointing at the strip or moving keyboard focus into it eases it
// to a stop (G's decision: it moves by itself, and stops when asked to); leaving lets it pick up
// again. It can be dragged sideways. The original draws images on a canvas; here the logos stay
// DOM elements with real text, so the site's font is used and a screen reader reads the names
// once (the copies that close the loop are hidden). Off screen it does not run; with reduced
// motion it stands still, magnified around the middle.

const SPEED_PX = 32; // per second
const EASE = 4; // how quickly the speed follows a hover or a release; higher is faster
const MAX_SCALE = 1.25; // at the centre
const MIN_SCALE = 0.6; // at the edges
const MAX_BLUR_PX = 2;
const BLUR_END = 0.64; // share of half the width where the blur is full
const MIN_OPACITY = 0.7; // kept high enough for the names to stay readable
const COPIES = 3;

export function LogoCarousel({ label, items }: { label: string; items: ReactNode[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll<HTMLElement>("[data-logo]")];
    if (nodes.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let widths: number[] = [];
    let positions: number[] = [];
    let wrap = 0;
    let minX = 0;
    let gap = 0;
    let width = 0;
    function measure() {
      // Measured in the plain row, before the logos are lifted out of it.
      root!.removeAttribute("data-ready");
      nodes.forEach((node) => (node.style.transform = ""));
      gap = parseFloat(getComputedStyle(root!).columnGap) || 0;
      widths = nodes.map((node) => node.offsetWidth);
      width = root!.clientWidth;
      wrap = 0;
      positions = widths.map((w) => {
        const x = wrap;
        wrap += w + gap;
        return x;
      });
      minX = -Math.max(...widths) * 2;
      root!.setAttribute("data-ready", "");
    }

    let offset = 0;
    let speed = reduce ? 0 : SPEED_PX;
    let held = false; // pointer over the strip or focus inside it
    let dragging = false;
    let dragX = 0;
    let last = performance.now();
    let frame = 0;
    let visible = false;
    let drawnAt = Number.NaN;

    function draw() {
      const centre = width / 2;
      const half = (MAX_SCALE - MIN_SCALE) / 2;
      const average = MIN_SCALE + half;
      const blurEnd = centre * BLUR_END;
      nodes.forEach((node, index) => {
        const w = widths[index];
        let x = (positions[index] - offset - minX) % wrap;
        if (x < 0) x += wrap;
        x += minX;
        const distance = x + w / 2 - centre;
        let warped: number;
        let scale: number;
        // Inside the middle span the spacing follows a sine and the size a cosine, so the logos
        // bunch at the sides and spread at the centre; beyond it they move evenly at the edge size.
        if (Math.abs(distance) <= centre) {
          warped = average * distance + half * (centre / Math.PI) * Math.sin((distance * Math.PI) / centre);
          scale = average + half * Math.cos((distance * Math.PI) / centre);
        } else {
          const sign = Math.sign(distance);
          warped = sign * average * centre + MIN_SCALE * (distance - sign * centre);
          scale = MIN_SCALE;
        }
        const reach = Math.min(1, Math.abs(distance) / blurEnd);
        const blur = reach * reach * (3 - 2 * reach) * MAX_BLUR_PX;
        const depth = (scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
        node.style.transform = `translate(${(centre + warped - w / 2).toFixed(1)}px, -50%) scale(${scale.toFixed(3)})`;
        node.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : "";
        node.style.opacity = (MIN_OPACITY + (1 - MIN_OPACITY) * depth).toFixed(2);
      });
      drawnAt = offset;
    }

    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const target = held || dragging || reduce ? 0 : SPEED_PX;
      speed += (target - speed) * EASE * dt;
      // The easing never quite arrives; below half a pixel a second it is simply stopped.
      if (target === 0 && Math.abs(speed) < 0.5) speed = 0;
      offset += speed * dt;
      // Standing still, nothing is written; the loop only waits.
      if (Math.abs(offset - drawnAt) > 0.01) draw();
      frame = visible ? requestAnimationFrame(tick) : 0;
    }

    measure();
    draw();

    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible && !frame && !reduce) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    });
    observer.observe(root);

    const resize = new ResizeObserver(() => {
      measure();
      draw();
    });
    resize.observe(root);

    const hold = () => (held = true);
    const release = () => (held = false);
    const leaveFocus = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) held = false;
    };
    const down = (event: PointerEvent) => {
      if (reduce) return;
      dragging = true;
      dragX = event.clientX;
      root.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      offset -= event.clientX - dragX;
      dragX = event.clientX;
      if (!frame) draw();
    };
    const up = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    };
    root.addEventListener("pointerenter", hold);
    root.addEventListener("pointerleave", release);
    root.addEventListener("focusin", hold);
    root.addEventListener("focusout", leaveFocus);
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);

    return () => {
      observer.disconnect();
      resize.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("pointerenter", hold);
      root.removeEventListener("pointerleave", release);
      root.removeEventListener("focusin", hold);
      root.removeEventListener("focusout", leaveFocus);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
    };
  }, [items.length]);

  // Before the script runs (and without it) the logos are a plain row; once measured they are
  // lifted out of it and placed by the loop.
  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="group"
      aria-label={label}
      className="group/lc relative flex h-24 cursor-grab touch-pan-y select-none items-center gap-16 overflow-hidden rounded-control mask-fade-edges focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:cursor-grabbing md:h-28"
    >
      {/* One list: the first set is read, the copies that close the loop are hidden. */}
      <ul role="list" className="contents">
        {Array.from({ length: COPIES }, (_, copy) =>
          items.map((item, index) => (
            <li
              key={`${copy}-${index}`}
              data-logo=""
              aria-hidden={copy > 0 ? true : undefined}
              className="shrink-0 text-fg group-data-[ready]/lc:absolute group-data-[ready]/lc:left-0 group-data-[ready]/lc:top-1/2 group-data-[ready]/lc:will-change-transform"
            >
              {item}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
