"use client";

import { useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { normalizeSearch } from "@/lib/branch-detail";
import { cn } from "@/lib/cn";
import { MAX_QUOTE_CITIES, TURKISH_CITIES } from "@/lib/turkish-cities";

type CityPickerProps = {
  // The chosen cities, joined with ", " (the form keeps one string, as the API does).
  value: string;
  onChange: (value: string) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export const parseCities = (value: string) => value.split(",").map((city) => city.trim()).filter(Boolean);

// Several cities chosen from a list (SPEC §2.2.3, v0.9, G): the field is a text box inside the
// frame of the control, with the chosen cities as chips before it. Typing shows the cities whose
// names START with the letters, the Turkish way (so "i" or "İ" gives İstanbul, İzmir and, because
// the dotless one is folded in too, Iğdır and Isparta); arrow keys move, Enter or a click adds,
// Backspace on an empty field takes the last one back, Escape closes. Nothing else can be
// entered. A combobox with a listbox, each chip with a button that names the city it removes.
export function CityPicker({ value, onChange, id, ...aria }: CityPickerProps) {
  const t = useTranslations("QuoteForm");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const chosen = useMemo(() => parseCities(value), [value]);
  const full = chosen.length >= MAX_QUOTE_CITIES;

  const matches = useMemo(() => {
    const needle = normalizeSearch(query.trim());
    return TURKISH_CITIES.filter(
      (city) => !chosen.includes(city) && (needle === "" || normalizeSearch(city).startsWith(needle)),
    );
  }, [chosen, query]);

  function add(city: string) {
    if (full || chosen.includes(city)) return;
    onChange([...chosen, city].join(", "));
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function remove(city: string) {
    onChange(chosen.filter((entry) => entry !== city).join(", "));
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      // Enter chooses a city; it must not send the form.
      event.preventDefault();
      if (open && matches[active]) add(matches[active]);
    } else if (event.key === "Escape") {
      if (open) {
        event.stopPropagation();
        setOpen(false);
      }
    } else if (event.key === "Backspace" && query === "" && chosen.length > 0) {
      remove(chosen[chosen.length - 1]);
    }
  }

  const showList = open && !full;
  const activeId = showList && matches[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-control border border-border-strong bg-surface px-2 py-0.5 text-body text-fg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
          aria["aria-invalid"] && "border-error",
        )}
      >
        {chosen.map((city) => (
          <span key={city} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-selected pl-4 pr-1 text-small text-on-selected">
            {city}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                remove(city);
              }}
              aria-label={t("citiesRemove", { city })}
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-border"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          value={query}
          disabled={full}
          placeholder={chosen.length === 0 ? t("citiesPlaceholder") : full ? t("citiesMax", { max: MAX_QUOTE_CITIES }) : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // The options take the click on mousedown, so the list is still there when it lands.
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-h-11 min-w-32 flex-1 bg-transparent px-1 outline-none disabled:cursor-not-allowed"
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={t("cities")}
        hidden={!showList}
        className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-overlay"
      >
        {matches.length === 0 ? (
          <li role="presentation" className="px-3 py-2 text-small text-fg-muted">
            {t("citiesEmpty")}
          </li>
        ) : (
          matches.map((city, index) => (
            <li
              key={city}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                add(city);
              }}
              onMouseMove={() => setActive(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-control px-3 text-body text-fg",
                index === active && "bg-selected text-on-selected",
              )}
            >
              {city}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
