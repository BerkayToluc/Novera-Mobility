"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { StatusChip } from "@/components/admin/status-chip";
import { useToast } from "@/components/admin/toast";
import type { Href } from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import type { Sort } from "@/lib/admin-query";
import { cn } from "@/lib/cn";
import { reflectExpenses, setExpenseStatus } from "@/lib/expense-actions";
import { expenseTone, isReflectable, type FleetExpense } from "@/lib/expenses";
import { rateLimitMessage } from "@/lib/rate-limit";

type Props = {
  rows: FleetExpense[];
  sort: Sort | null;
  // The address a sortable header leads to, per column: the sort is in the address, so it can be shared.
  sortHrefs: Record<string, Href>;
};

// The expenses of the company with a choice in front of each row (V2-38, docs/FLEET.md §3): "Personele yansıt" for the chosen ones, and
// "İtiraz et" / "İtirazı geri al" on a row. Only the open expenses that have a person can be chosen, so the button never promises more
// than the API will do; the person written on the row is the one who had the car at that moment. The version of each expense travels
// with the call, so an expense that changed since this screen was drawn is not overwritten.
export function ExpenseTable({ rows, sort, sortHrefs }: Props) {
  const t = useTranslations("FleetPanel.expenses");
  const tableT = useTranslations("Admin.table");
  const limitT = useTranslations("RateLimit");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  const moment = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const reflectable = rows.filter(isReflectable);
  // What is chosen and still can be (a row that changed after it was chosen drops out).
  const ids = reflectable.filter((row) => chosen.has(row.id)).map((row) => row.id);
  const allChosen = reflectable.length > 0 && ids.length === reflectable.length;

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function failure(status: string, retryAfter?: number | null) {
    if (status === "stale") toast.show(t("errors.stale"), "error");
    else if (status === "not_allowed") toast.show(t("errors.notAllowed"), "error");
    else if (status === "not_found") toast.show(t("errors.notFound"), "error");
    else if (status === "rate_limited") toast.show(rateLimitMessage(limitT, retryAfter), "error");
    else toast.show(t("errors.unavailable"), "error");
  }

  async function reflect() {
    setPending(true);
    const result = await reflectExpenses(ids);
    setPending(false);
    setAsking(false);
    if (result.status === "ok") {
      toast.show(result.skipped > 0 ? t("toast.reflectedSkipped", { count: result.reflected, skipped: result.skipped }) : t("toast.reflected", { count: result.reflected }));
      setChosen(new Set());
    } else {
      failure(result.status, "retryAfter" in result ? result.retryAfter : null);
    }
    router.refresh();
  }

  async function dispute(row: FleetExpense, status: "DISPUTED" | "OPEN") {
    setPending(true);
    const result = await setExpenseStatus(row.id, row.updatedAt, status);
    setPending(false);
    if (result.status === "ok") toast.show(status === "DISPUTED" ? t("toast.disputed") : t("toast.reopened"));
    else failure(result.status, "retryAfter" in result ? result.retryAfter : null);
    router.refresh();
  }

  const header = (key: string, label: string, align?: "right") => {
    const href = sortHrefs[key];
    const active = sort?.key === key;
    return (
      <th
        scope="col"
        aria-sort={href ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
        className={cn("border-b border-border px-4 py-1 text-label text-fg-muted", align === "right" && "text-right")}
      >
        {href ? (
          <Link href={href} aria-label={tableT("sortBy", { column: label })} className={cn("inline-flex min-h-11 items-center gap-1 hover:text-fg", align === "right" && "flex-row-reverse")}>
            {label}
            {active ? sort!.dir === "asc" ? <ArrowUp aria-hidden="true" className="size-4" /> : <ArrowDown aria-hidden="true" className="size-4" /> : <ChevronsUpDown aria-hidden="true" className="size-4" />}
          </Link>
        ) : (
          label
        )}
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={ids.length === 0 || pending} onClick={() => setAsking(true)}>
          {ids.length > 0 ? t("reflect.buttonCount", { count: ids.length }) : t("reflect.button")}
        </Button>
        <p role="status" className="text-small text-fg-muted">
          {ids.length > 0 ? t("reflect.hint", { count: ids.length }) : t("reflect.none")}
        </p>
      </div>

      <div role="region" aria-label={tableT("scrollable", { table: t("tableCaption") })} tabIndex={0} className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-max border-collapse text-left text-body text-fg">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="w-12 border-b border-border px-4 py-1">
                <label className="flex min-h-11 items-center">
                  <input
                    type="checkbox"
                    className="size-5 rounded-control border-border-strong"
                    checked={allChosen}
                    disabled={reflectable.length === 0}
                    onChange={() => setChosen(allChosen ? new Set() : new Set(reflectable.map((row) => row.id)))}
                  />
                  <span className="sr-only">{t("selectAll")}</span>
                </label>
              </th>
              {header("occurredAt", t("columns.occurredAt"))}
              {header("vehicle", t("columns.vehicle"))}
              {header("type", t("columns.type"))}
              {header("amount", t("columns.amount"), "right")}
              {header("employee", t("columns.employee"))}
              {header("status", t("columns.status"))}
              {header("actions", t("columns.actions"))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border first:border-t-0">
                <td className="px-4 py-2 align-middle">
                  {isReflectable(row) && (
                    <label className="flex min-h-11 items-center">
                      <input type="checkbox" className="size-5 rounded-control border-border-strong" checked={chosen.has(row.id)} onChange={() => toggle(row.id)} />
                      <span className="sr-only">{t("selectRow", { plate: row.vehicle.plate })}</span>
                    </label>
                  )}
                </td>
                <td className="px-4 py-2 align-middle">{moment.format(new Date(row.occurredAt))}</td>
                <td className="px-4 py-2 align-middle">
                  <Link href={{ pathname: "/filom/araclar/[plate]", params: { plate: row.vehicle.plate.replace(/ /g, "") } }} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                    {row.vehicle.plate}
                  </Link>
                </td>
                <td className="px-4 py-2 align-middle">{t(`type.${row.type}`)}</td>
                <td className="px-4 py-2 text-right align-middle tabular-nums">{money.format(row.amount / 100)}</td>
                <td className="px-4 py-2 align-middle">
                  {row.employee ? (
                    <span className="flex flex-col">
                      <span>{row.employee.name}</span>
                      {row.employee.department && <span className="max-w-40 truncate text-small text-fg-muted">{row.employee.department}</span>}
                    </span>
                  ) : (
                    <span className="text-fg-muted">{t("unassigned")}</span>
                  )}
                </td>
                <td className="px-4 py-2 align-middle">
                  <StatusChip tone={expenseTone(row.status)}>{t(`status.${row.status}`)}</StatusChip>
                </td>
                <td className="px-4 py-2 align-middle">
                  {row.status === "OPEN" && (
                    <Button type="button" variant="outline" size="compact" disabled={pending} onClick={() => void dispute(row, "DISPUTED")} aria-label={`${t("dispute")}: ${t("rowActionsFor", { plate: row.vehicle.plate })}`}>
                      {t("dispute")}
                    </Button>
                  )}
                  {row.status === "DISPUTED" && (
                    <Button type="button" variant="outline" size="compact" disabled={pending} onClick={() => void dispute(row, "OPEN")} aria-label={`${t("undispute")}: ${t("rowActionsFor", { plate: row.vehicle.plate })}`}>
                      {t("undispute")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={asking}
        tone="primary"
        title={t("reflect.dialogTitle", { count: ids.length })}
        text={t("reflect.dialogText")}
        confirmLabel={t("reflect.confirm")}
        cancelLabel={t("reflect.keep")}
        pending={pending}
        onCancel={() => setAsking(false)}
        onConfirm={() => void reflect()}
      />
    </div>
  );
}
