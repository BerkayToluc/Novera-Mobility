"use client";

import { useId, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type FaqQuestion = { id: string; question: string; answer: string };

type FaqTabsProps = {
  // Names the group of category buttons for assistive technology ("Konular").
  label: string;
  // Category key to its label, in the order the tabs are shown.
  categories: Record<string, string>;
  // The questions of each category key.
  faqData: Record<string, FaqQuestion[]>;
  className?: string;
};

// A FAQ with category tabs (SPEC §2.2.5), after the "FAQ with tabs" component: the chosen tab fills
// from below, the list slides in, and the open row turns its plus a quarter turn. Rebuilt on the
// site's tokens (no gradients or glow, 44 px targets, the focus ring) and with every row a real
// button that says whether it is open. Rows open on their own, not one at a time. With reduced
// motion the movement is dropped and only the fade stays (MotionConfig). A closed answer is not
// in the page at all, so a screen reader or the Tab key never lands in hidden text; the price is
// that the browser's find-in-page does not see it.
export function FaqTabs({ label, categories, faqData, className }: FaqTabsProps) {
  const keys = Object.keys(categories);
  const [selected, setSelected] = useState(keys[0]);
  const panelId = useId();
  const questions = faqData[selected] ?? [];

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex flex-col gap-6", className)}>
        <div role="group" aria-label={label} className="flex flex-wrap gap-2">
          {keys.map((key) => {
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-controls={panelId}
                onClick={() => setSelected(key)}
                className={cn(
                  "relative isolate inline-flex min-h-11 items-center overflow-hidden whitespace-nowrap rounded-full border px-4 text-label transition-colors duration-500",
                  active ? "border-primary text-on-primary" : "border-border-strong bg-surface text-fg hover:bg-selected",
                )}
              >
                {categories[key]}
                <AnimatePresence>
                  {active && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ y: "100%" }}
                      animate={{ y: "0%" }}
                      exit={{ y: "100%" }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                      className="absolute inset-0 -z-10 bg-primary"
                    />
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        <div id={panelId} role="region" aria-label={categories[selected]}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={selected}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-3"
            >
              {questions.map((item, index) => (
                // The first row of a category starts open, so the answer is already in sight.
                <FaqRow key={item.id} {...item} startOpen={index === 0} />
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

function FaqRow({ question, answer, startOpen }: Omit<FaqQuestion, "id"> & { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const answerId = useId();

  return (
    <li className={cn("rounded-card border border-border transition-colors", open ? "bg-surface-muted" : "bg-surface")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-6 rounded-card px-5 py-4 text-left"
      >
        <span className={cn("text-body font-semibold transition-colors", open ? "text-fg" : "text-fg")}>{question}</span>
        <motion.span aria-hidden="true" animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
          <Plus className="size-5 text-fg-muted" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={answerId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="max-w-prose px-5 pb-5 text-body text-fg-muted">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
