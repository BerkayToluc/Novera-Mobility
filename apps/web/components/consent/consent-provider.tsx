"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, serializeConsent, type Consent } from "@/lib/consent";
import { ConsentBanner } from "./consent-banner";
import { ConsentDialog } from "./consent-dialog";

type ConsentContext = {
  choice: Consent | null;
  // The cookie settings window, from the banner or the footer.
  openSettings: () => void;
};

const Context = createContext<ConsentContext | null>(null);

export function useConsent(): ConsentContext {
  const value = useContext(Context);
  if (!value) throw new Error("useConsent must be used inside ConsentProvider");
  return value;
}

// Holds the cookie choice for the whole page: the banner shows until there is one, and the
// settings window can be opened again from anywhere (the footer's "Cookie preferences").
export function ConsentProvider({ initial, children }: { initial: Consent | null; children: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<Consent | null>(initial);

  const openSettings = useCallback(() => dialogRef.current?.showModal(), []);

  const save = useCallback(
    (analytics: boolean) => {
      document.cookie = `${CONSENT_COOKIE}=${serializeConsent(analytics)}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
      setChoice({ v: 1, analytics });
      dialogRef.current?.close();
      // The server decides whether analytics is written into the page, so it is asked again.
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ choice, openSettings }), [choice, openSettings]);

  return (
    <Context.Provider value={value}>
      {children}
      {choice === null && <ConsentBanner onAccept={() => save(true)} onReject={() => save(false)} onSettings={openSettings} />}
      <ConsentDialog ref={dialogRef} analytics={choice?.analytics ?? false} onSave={save} />
    </Context.Provider>
  );
}
