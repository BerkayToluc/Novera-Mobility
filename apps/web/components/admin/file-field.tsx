"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { controlClasses } from "@/components/ui/input";
import type { UploadAction, UploadResult } from "@/lib/admin-upload";
import { cn } from "@/lib/cn";
import { prepareImage } from "@/lib/image-prepare";
import { MAX_UPLOAD_BYTES, MIN_WIDTH } from "@/lib/image-rules";

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
  // With an upload, the field sends the chosen picture to it at once (ADR-28) and the form carries only the address that comes
  // back, in a hidden field of this `name`. Without one, the field is only the look and the checks the browser can make.
  upload?: UploadAction;
  // The width the picture has to have, shown as a hint and checked in the browser before anything is sent.
  minWidth?: number;
  // The address of the stored picture once it is uploaded, or `null` when it is removed or replaced.
  onUploaded?: (url: string | null) => void;
};

const MESSAGE_OF: Record<Exclude<UploadResult["status"], "ok">, "serverTooLarge" | "wrongType" | "tooNarrow" | "unreadable" | "forbidden" | "unavailable"> = {
  too_large: "serverTooLarge",
  wrong_type: "wrongType",
  too_narrow: "tooNarrow",
  unreadable: "unreadable",
  forbidden: "forbidden",
  unavailable: "unavailable",
};

// The picture or file field of a panel form (ADMIN.md §3.3). Alone it is the browser's own file input with the checks the
// browser can make (type and size, so a wrong file is refused at once). With an `upload` (ADR-28) it also prepares the picture
// in the browser (smaller, so a 5 MB phone photo fits the request the host allows), sends it, and says what happened in words
// a screen reader hears: "working", "uploaded", or what is wrong with the file. The server repeats every check.
export function FileField({ label, name, accept, typesLabel, maxSizeMb, error, onChange, upload, minWidth = MIN_WIDTH, onUploaded }: Props) {
  const t = useTranslations("Admin.file");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [stored, setStored] = useState<string | null>(null);
  // Which choice the answer belongs to: a slow answer to a file that was since replaced or removed is ignored.
  const turn = useRef(0);

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

  function clear(message: string | null) {
    // A refused file is not kept in the input either, or the form would still send it.
    if (inputRef.current) inputRef.current.value = "";
    keep(null);
    setStored(null);
    setProblem(message);
    onChange?.(null);
    onUploaded?.(null);
  }

  async function send(chosen: File, mine: number) {
    setWorking(true);
    const prepared = await prepareImage(chosen);
    if (mine !== turn.current) return;
    // Checked here as well, so a picture that is too narrow is told at once and nothing is sent.
    if (prepared.width !== null && prepared.width < minWidth) {
      setWorking(false);
      clear(t("tooNarrow", { min: minWidth }));
      return;
    }
    // Something the browser cannot open and that is too big to send: there is nothing the server could tell more.
    if (prepared.width === null && prepared.file.size > MAX_UPLOAD_BYTES) {
      setWorking(false);
      clear(t("unreadable"));
      return;
    }
    const data = new FormData();
    data.append("file", prepared.file);
    let result: UploadResult;
    try {
      result = await upload!(data);
    } catch {
      result = { status: "unavailable" };
    }
    if (mine !== turn.current) return;
    setWorking(false);
    if (result.status === "ok") {
      setProblem(null);
      setStored(result.url);
      onUploaded?.(result.url);
    } else {
      clear(t(MESSAGE_OF[result.status], { min: minWidth }));
    }
  }

  function pick(chosen: File | null) {
    turn.current += 1;
    const mine = turn.current;
    setWorking(false);
    if (chosen && !accept.split(",").map((type) => type.trim()).includes(chosen.type)) {
      clear(t("wrongType"));
      return;
    }
    if (chosen && chosen.size > maxSizeMb * 1024 * 1024) {
      clear(t("tooLarge", { size: maxSizeMb }));
      return;
    }
    setProblem(null);
    setStored(null);
    keep(chosen);
    onChange?.(chosen);
    if (!chosen) {
      onUploaded?.(null);
      return;
    }
    if (upload) void send(chosen, mine);
  }

  const shown = error ?? problem;
  const describedBy = [`${id}-hint`, shown ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-fg">
        {label}
      </label>
      {/* With an upload the form carries the address of the stored picture, not the file itself. */}
      {upload && <input type="hidden" name={name} value={stored ?? ""} />}
      <input
        ref={inputRef}
        id={id}
        name={upload ? undefined : name}
        type="file"
        accept={accept}
        aria-describedby={describedBy}
        aria-invalid={shown ? true : undefined}
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
        className={cn(controlClasses, "py-2 file:mr-3 file:rounded-control file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-label file:text-fg")}
      />
      <p id={`${id}-hint`} className="text-small text-fg-muted">
        {t("limits", { types: typesLabel, size: maxSizeMb })}
        {upload && ". " + t("minWidthHint", { min: minWidth })}
      </p>
      {shown && (
        <p id={`${id}-error`} className="text-small text-error">
          {shown}
        </p>
      )}
      {/* The state of the upload, in a region that is always there so a change in it is announced. */}
      {upload && (
        <p role="status" className="text-small text-fg-muted">
          {working ? t("working") : stored ? t("uploaded") : ""}
        </p>
      )}
      {file ? (
        <div className="flex flex-wrap items-center gap-3">
          {(stored ?? preview) && (
            <Image src={(stored ?? preview)!} alt="" width={96} height={60} unoptimized loading="eager" className="aspect-16/10 w-24 rounded-media object-cover" />
          )}
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
