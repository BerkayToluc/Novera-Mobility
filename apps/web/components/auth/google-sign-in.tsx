"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AuthRateLimitedError,
  AuthUnavailableError,
  GoogleConsentRequiredError,
  GoogleNotAllowedError,
  GoogleNotConfiguredError,
  GoogleTokenInvalidError,
  loginWithGoogle,
} from "@/lib/auth-client";
import { FormError } from "./form-error";
import { rateLimitMessage } from "@/lib/rate-limit";

// The part of Google Identity Services this page uses.
type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

// "Continue with Google" on the sign-in and sign-up pages (individual accounts only). The button is
// Google's own: it hands this page an ID token, which goes to the API through signInWithGoogle. A Google
// account with no Novera account needs the privacy consent first, so the box is shown and the same token is
// sent again with it. `clientId` empty hides everything; `sample` (USE_MOCKS=1) shows a stand-in button that
// needs no Google. `nonce` is the page's script nonce, which the Content-Security-Policy asks of the script tag.
export function GoogleSignIn({
  clientId,
  sample,
  nonce,
  next,
}: {
  clientId: string | null;
  sample: boolean;
  nonce?: string;
  next?: Record<string, string>;
}) {
  const t = useTranslations("Auth");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const locale = useLocale();
  const buttonRef = useRef<HTMLDivElement>(null);
  const introId = useId();
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [pending, setPending] = useState(false);

  const attempt = useCallback(
    async (token: string, agreed?: boolean) => {
      setError(null);
      setPending(true);
      try {
        const language = await loginWithGoogle(token, agreed);
        if (next) router.push({ pathname: "/odeme", query: next }, { locale: language });
        else router.push("/profil", { locale: language });
        // The header reads the session on the server, so it has to be asked again.
        router.refresh();
      } catch (failure) {
        if (failure instanceof GoogleConsentRequiredError) {
          setCredential(token);
        } else if (failure instanceof GoogleNotAllowedError) setError(t("google.errors.notAllowed"));
        else if (failure instanceof GoogleTokenInvalidError) setError(t("google.errors.invalidToken"));
        else if (failure instanceof GoogleNotConfiguredError) setError(t("google.errors.notConfigured"));
        else if (failure instanceof AuthRateLimitedError) setError(rateLimitMessage(limitT, failure.retryAfter));
        else if (failure instanceof AuthUnavailableError) setError(t("errors.unavailable"));
        else setError(t("errors.generic"));
      } finally {
        setPending(false);
      }
    },
    [limitT, next, router, t],
  );

  // Loads Google's script once and draws its button. Created here (not in the markup) so the page's
  // nonce can go on it and the button is drawn as soon as the script is ready.
  useEffect(() => {
    if (!clientId || sample) return;
    const draw = () => {
      const id = window.google?.accounts.id;
      if (!id || !buttonRef.current) return;
      id.initialize({ client_id: clientId, callback: (response) => void attempt(response.credential) });
      id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: 320,
        locale,
      });
    };
    if (window.google?.accounts.id) {
      draw();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    if (nonce) script.nonce = nonce;
    script.onload = draw;
    document.head.appendChild(script);
    // credential: the button is drawn again when the consent box is cancelled and the button comes back.
  }, [attempt, clientId, credential, locale, nonce, sample]);

  if (!sample && !clientId) return null;

  function onContinue() {
    if (!credential) return;
    if (!consent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    void attempt(credential, true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-small text-fg-muted" role="separator" aria-label={t("google.or")}>
        <span className="h-px flex-1 bg-border" />
        <span aria-hidden="true">{t("google.or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {credential === null ? (
        <>
          {sample ? (
            <Button type="button" variant="outline" size="lg" disabled={pending} aria-busy={pending} onClick={() => void attempt("sample-credential")}>
              {t("google.sample")}
            </Button>
          ) : (
            <div ref={buttonRef} className="flex min-h-11 justify-center" />
          )}
        </>
      ) : (
        // A new account: Google signed the visitor in, Novera still needs the consent to open one.
        <div role="group" aria-labelledby={introId} className="flex flex-col gap-3 rounded-control border border-border bg-surface-muted p-4">
          <p id={introId} className="text-body text-fg">
            {t("google.consentIntro")}
          </p>
          <Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)} aria-invalid={consentError ? true : undefined}>
            {t.rich("register.consent", {
              link: (chunks) => (
                <Link href="/kvkk" className="text-link underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </Checkbox>
          {consentError && (
            <p role="alert" className="text-small text-error">
              {t("errors.consent")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={pending} aria-busy={pending} onClick={onContinue}>
              {pending ? t("google.continuing") : t("google.continue")}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setCredential(null); setConsent(false); setConsentError(false); }}>
              {t("google.cancel")}
            </Button>
          </div>
        </div>
      )}

      <FormError message={error} />
      <p className="text-small text-fg-muted">{t("google.linkNote")}</p>
    </div>
  );
}
