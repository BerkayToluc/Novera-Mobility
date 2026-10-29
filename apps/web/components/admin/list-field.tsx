"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { id: number; text: string };

type Props = {
  label: string;
  // The form fields are all called `name`, one per row, in the order shown.
  name: string;
  defaultValue?: readonly string[];
  onChange?: (value: string[]) => void;
  max?: number;
  maxLength?: number;
};

// A list of short texts the person can add to, delete from and reorder (ADMIN.md §3.4): opening hours, features. It is all
// buttons, so it works with a keyboard; focus stays where the person was after each action, and a polite live region says
// what happened (a screen reader cannot see a row move).
export function ListField({ label, name, defaultValue = [], onChange, max = 20, maxLength = 80 }: Props) {
  const t = useTranslations("Admin.list");
  const groupId = useId();
  const nextId = useRef(defaultValue.length);
  const [rows, setRows] = useState<Row[]>(() => defaultValue.map((text, id) => ({ id, text })));
  const [announcement, setAnnouncement] = useState("");
  // What to focus once the rows have been drawn again.
  const focusAfter = useRef<{ id: number; part: "input" | "up" | "down" | "remove" } | "add" | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const item = (index: number) => t("item", { n: index + 1 });

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === "add") addRef.current?.focus();
    else if (target) refs.current.get(`${target.id}:${target.part}`)?.focus();
  });

  function commit(next: Row[]) {
    setRows(next);
    onChange?.(next.map((row) => row.text));
  }

  function add() {
    if (rows.length >= max) return;
    const id = nextId.current++;
    focusAfter.current = { id, part: "input" };
    commit([...rows, { id, text: "" }]);
    setAnnouncement(t("added", { count: rows.length + 1 }));
  }

  function remove(index: number) {
    const next = rows.filter((_, i) => i !== index);
    const neighbour = next[Math.min(index, next.length - 1)];
    focusAfter.current = neighbour ? { id: neighbour.id, part: "input" } : "add";
    commit(next);
    setAnnouncement(t("removed", { count: next.length }));
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to]!, next[index]!];
    const id = rows[index]!.id;
    // At the end of the list the button that was pressed is disabled, so focus goes to the other one.
    focusAfter.current = { id, part: by === -1 ? (to === 0 ? "down" : "up") : to === rows.length - 1 ? "up" : "down" };
    commit(next);
    // Named by where it WAS, so "Row 3 moved to position 2" tells a person who cannot see the rows what changed.
    setAnnouncement(t("moved", { item: item(index), position: to + 1 }));
  }

  const setRef = (id: number, part: string) => (node: HTMLElement | null) => {
    if (node) refs.current.set(`${id}:${part}`, node);
    else refs.current.delete(`${id}:${part}`);
  };

  return (
    <fieldset aria-labelledby={`${groupId}-legend`} className="flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend id={`${groupId}-legend`} className="mb-2 p-0 text-label text-fg">
        {label}
      </legend>
      {rows.length === 0 ? (
        <p className="text-small text-fg-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-1">
              <label htmlFor={`${groupId}-${row.id}`} className="sr-only">
                {item(index)}
              </label>
              <Input
                id={`${groupId}-${row.id}`}
                ref={setRef(row.id, "input")}
                name={name}
                value={row.text}
                maxLength={maxLength}
                onChange={(event) => commit(rows.map((r) => (r.id === row.id ? { ...r, text: event.target.value } : r)))}
                className="min-w-0 flex-1"
              />
              <Button
                ref={setRef(row.id, "up")}
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === 0}
                aria-label={t("moveUp", { item: item(index) })}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
              </Button>
              <Button
                ref={setRef(row.id, "down")}
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === rows.length - 1}
                aria-label={t("moveDown", { item: item(index) })}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" className="size-4" />
              </Button>
              <Button ref={setRef(row.id, "remove")} type="button" variant="ghost" size="icon" aria-label={t("remove", { item: item(index) })} onClick={() => remove(index)}>
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button ref={addRef} type="button" variant="outline" className="self-start" disabled={rows.length >= max} onClick={add}>
        <Plus aria-hidden="true" className="size-4" />
        {t("add")}
      </Button>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  );
}
