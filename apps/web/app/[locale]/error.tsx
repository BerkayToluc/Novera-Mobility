"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// The 500 page (ARCHITECTURE ADR-23): anything unexpected that is thrown below the root layout
// lands here, with the header and footer still in place. Expected failures (the API being out of
// reach) are handled by the pages themselves; this is for what nobody planned for.
export default function ServerError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("ServerError");

  useEffect(() => {
    // Until an error reporting service is chosen, the console is where it can be found.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-4 py-16 md:px-8 xl:py-24">
      {/* An error page has nothing for a search engine to index. */}
      <meta name="robots" content="noindex" />
      <p className="text-label text-fg-muted">{t("code")}</p>
      <h1 className="text-h1 text-fg">{t("title")}</h1>
      <p className="max-w-prose text-body text-fg-muted">{t("description")}</p>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
      {/* The digest is what lets a support request be matched to the server's log. */}
      {error.digest && (
        <p className="text-small text-fg-muted">
          {t("reference")}: <code>{error.digest}</code>
        </p>
      )}
    </div>
  );
}
