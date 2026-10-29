import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { pageCount, pageWindow } from "@/lib/admin-query";
import { cn } from "@/lib/cn";
import type { Href } from "./types";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => Href;
};

const linkClasses = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control border px-3 text-label transition-colors";

// The way between the pages of a list (ADMIN.md §3.4): 20 to a page, the page in the address. Past `md` it shows page
// numbers, below it only "previous", "page 2 of 5" and "next", which is what fits on a phone.
export function Pagination({ page, pageSize, total, hrefFor }: Props) {
  const t = useTranslations("Admin.pagination");
  const pages = pageCount(total, pageSize);
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-small text-fg-muted">{total === 0 ? t("none") : t("range", { from, to, total })}</p>
      {pages > 1 && (
        <nav aria-label={t("label")}>
          <ul className="flex flex-wrap items-center gap-1">
            <li>
              {current > 1 ? (
                <Link href={hrefFor(current - 1)} rel="prev" className={cn(linkClasses, "border-border-strong bg-surface text-fg hover:bg-selected")}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  <span className="max-md:sr-only">{t("previous")}</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(linkClasses, "border-border text-fg-subtle")}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  <span className="max-md:sr-only">{t("previous")}</span>
                </span>
              )}
            </li>
            <li className="md:hidden">
              <span className="px-2 text-label text-fg-muted">{t("status", { page: current, pages })}</span>
            </li>
            {pageWindow(current, pages).map((n, index) =>
              n === null ? (
                <li key={`gap-${index}`} aria-hidden="true" className="max-md:hidden px-1 text-fg-muted">
                  …
                </li>
              ) : (
                <li key={n} className="max-md:hidden">
                  <Link
                    href={hrefFor(n)}
                    aria-current={n === current ? "page" : undefined}
                    aria-label={t("page", { page: n })}
                    className={cn(
                      linkClasses,
                      n === current ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-fg hover:bg-selected",
                    )}
                  >
                    {n}
                  </Link>
                </li>
              ),
            )}
            <li>
              {current < pages ? (
                <Link href={hrefFor(current + 1)} rel="next" className={cn(linkClasses, "border-border-strong bg-surface text-fg hover:bg-selected")}>
                  <span className="max-md:sr-only">{t("next")}</span>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(linkClasses, "border-border text-fg-subtle")}>
                  <span className="max-md:sr-only">{t("next")}</span>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </span>
              )}
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
