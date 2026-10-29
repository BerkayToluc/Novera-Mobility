"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { controlClasses } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  name: string;
  // The `accept` list of the input, e.g. "image/jpeg,image/png,image/webp".
  accept: string;
  // How the types are named to a person ("JPEG, PNG, WebP").
  typesLabel: string;
  maxSizeMb: number;
  // The form's own message (a server answer); a problem found here in the browser is shown when this is empty.
  error?: string;
  onChange?: (file: File | null) => void;
};

// The picture or file field of a panel form (ADMIN.md §3.3): only the look and the checks the browser can make (type
// and size, so a wrong file is refused at once). The upload itself, and the real rules, are V2-28 (ADR-28), and the API
// repeats every check. It uses the browser's own file input, which is already a labelled, keyboard-reachable control.
export function FileField({ label, name, accept, typesLabel, maxSizeMb, error, onChange }: Props) {
  const t = useTranslations("Admin.file");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // The preview is a temporary address for the chosen file; it is made when a file is chosen and given back when it changes
  // or the field goes away (kept in a ref so the clean-up sees the last one).
  const previewRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  function keep(chosen: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = chosen?.type.startsWith("image/") ? URL.createObjectURL(chosen) : null;
    previewRef.current = url;
    setPreview(url);
    setFile(chosen);
  }

  function pick(chosen: File | null) {
    if (chosen && !accept.split(",").map((type) => type.trim()).includes(chosen.type)) {
      setProblem(t("wrongType"));
    } else if (chosen && chosen.size > maxSizeMb * 1024 * 1024) {
      setProblem(t("tooLarge", { size: maxSizeMb }));
    } else {
      setProblem(null);
      keep(chosen);
      onChange?.(chosen);
      return;
    }
    // A refused file is not kept in the input either, or the form would still send it.
    if (inputRef.current) inputRef.current.value = "";
    keep(null);
    onChange?.(null);
  }

  const shown = error ?? problem;
  const describedBy = [`${id}-hint`, shown ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-fg">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        aria-describedby={describedBy}
        aria-invalid={shown ? true : undefined}
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
        className={cn(controlClasses, "py-2 file:mr-3 file:rounded-control file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-label file:text-fg")}
      />
      <p id={`${id}-hint`} className="text-small text-fg-muted">
        {t("limits", { types: typesLabel, size: maxSizeMb })}
      </p>
      {shown && (
        <p id={`${id}-error`} className="text-small text-error">
          {shown}
        </p>
      )}
      {file ? (
        <div className="flex flex-wrap items-center gap-3">
          {preview && <Image src={preview} alt="" width={96} height={60} unoptimized className="aspect-16/10 w-24 rounded-media object-cover" />}
          <p className="min-w-0 break-all text-small text-fg">{file.name}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              pick(null);
            }}
          >
            {t("remove")}
          </Button>
        </div>
      ) : (
        <p className="text-small text-fg-muted">{t("none")}</p>
      )}
    </div>
  );
}
