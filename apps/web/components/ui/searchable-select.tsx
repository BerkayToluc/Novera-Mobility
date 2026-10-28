"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { normalizeSearch } from "@/lib/branch-detail";
import { controlClasses } from "./input";

export type SearchableOption = {
  value: string;
  label: string;
  // A short note on the right of the row, e.g. how many branches a city has.
  hint?: string;
};

type SearchableSelectProps = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  // Shown on the button while nothing is chosen.
  placeholder: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

// A drop-down with a search box in its panel (after the Framer "SearchableDropdown"): the button
// shows the choice, the panel holds a field to type in and the options that still match. Rebuilt on
// the site's pieces: the Popover for placement, focus and Escape; the arrow keys, Home, End and
// Enter move through the options from the search field (the original had no keys beyond Escape);
// a search that ignores case, Turkish letters and accents, so "izmir" finds "İzmir" and "sisli"
// finds "Şişli". The field takes the focus when the panel opens, and Escape returns it to the button.
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchLabel,
  searchPlaceholder,
  emptyText,
  id,
  className,
  ...aria
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const needle = normalizeSearch(query);
    return needle ? options.filter((option) => normalizeSearch(option.label).includes(needle)) : options;
  }, [options, query]);

  const chosen = options.find((option) => option.value === value);

  // Opening starts from the chosen option, with the search empty.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    }
  }

  // The option the arrow keys are on stays in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, shown]);

  function choose(option: SearchableOption) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(shown.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = shown[active];
      if (option) choose(option);
    }
  }

  const activeOption = shown[active];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(controlClasses, "group flex items-center justify-between gap-2 text-left", className)}
        {...aria}
      >
        <span className={chosen ? "text-fg" : "text-fg-subtle"}>{chosen?.label ?? placeholder}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-(--radix-popover-trigger-width) min-w-64 flex-col gap-2 p-2">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            role="combobox"
            aria-label={searchLabel}
            aria-expanded={shown.length > 0}
            aria-controls={shown.length > 0 ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className={cn(controlClasses, "pl-9")}
          />
        </div>
        {/* The listbox stays in the page (the combobox points at it) but hidden while nothing matches, since a listbox with no
            option is not valid ARIA; the "no match" line is its own status (V2-19, axe). */}
        <ul id={listId} ref={listRef} role="listbox" aria-label={searchLabel} hidden={shown.length === 0} className="max-h-64 overflow-y-auto">
          {shown.map((option, index) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                data-index={index}
                // The input keeps the focus; a click on a row must not take it away first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-body",
                  index === active ? "bg-selected text-on-selected" : "text-fg",
                )}
              >
                <span className="flex-1">{option.label}</span>
                {option.hint && <span className="text-small text-fg-muted">{option.hint}</span>}
                {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && (
          <p role="status" className="px-3 py-3 text-small text-fg-muted">
            {emptyText}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
