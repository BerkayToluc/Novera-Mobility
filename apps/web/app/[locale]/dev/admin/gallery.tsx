"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bilingual, BilingualField } from "@/components/admin/bilingual-field";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FileField } from "@/components/admin/file-field";
import { FilterChips } from "@/components/admin/filter-chips";
import { ListField } from "@/components/admin/list-field";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StaleWriteBanner } from "@/components/admin/stale-write-banner";
import { StatusChip, type StatusTone } from "@/components/admin/status-chip";
import { ToastProvider, useToast } from "@/components/admin/toast";
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { uploadVehicleImage } from "@/lib/admin-upload-actions";
import { hrefQuery, parseAdminListParams, type AdminListConfig } from "@/lib/admin-query";

type Status = "CONFIRMED" | "CANCELLED" | "PENDING" | "FAILED" | "INACTIVE";
type Row = { number: string; name: string; total: number; status: Status };

const NAMES = ["Ayşe Yılmaz", "Mert Kaya", "Elif Demir", "Can Aydın", "Zeynep Arslan", "Burak Şahin", "Selin Koç", "Emre Çelik", "Deniz Polat", "Ece Güneş", "Okan Yıldız", "Naz Özkan"];
const STATUSES: Status[] = ["CONFIRMED", "CANCELLED", "PENDING", "CONFIRMED", "FAILED", "CONFIRMED", "INACTIVE", "CONFIRMED", "CANCELLED", "CONFIRMED", "PENDING", "CONFIRMED"];
const ROWS: Row[] = NAMES.map((name, index) => ({
  number: `NVR-2026-${String(231 - index * 7).padStart(5, "0")}`,
  name,
  total: 125000 + ((index * 73) % 11) * 31000,
  status: STATUSES[index]!,
}));

const TONES: Record<Status, StatusTone> = { CONFIRMED: "success", CANCELLED: "neutral", PENDING: "warning", FAILED: "error", INACTIVE: "neutral" };
const STATUS_KEYS = { CONFIRMED: "confirmed", CANCELLED: "cancelled", PENDING: "pending", FAILED: "failed", INACTIVE: "neutral" } as const;

const CONFIG = {
  sortable: ["number", "name", "total"],
  defaultSort: { key: "number", dir: "desc" },
  filters: { durum: ["CONFIRMED", "CANCELLED", "PENDING", "FAILED", "INACTIVE"] },
  pageSize: 5,
} satisfies AdminListConfig<"durum">;

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

export function Gallery({ query }: { query: Record<string, string | string[] | undefined> }) {
  return (
    <ToastProvider>
      <GalleryBody query={query} />
    </ToastProvider>
  );
}

function GalleryBody({ query }: { query: Record<string, string | string[] | undefined> }) {
  const t = useTranslations("Admin.dev");
  const filterT = useTranslations("Admin.filter");
  const toast = useToast();
  const params = parseAdminListParams(query, CONFIG);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [bilingual, setBilingual] = useState<Bilingual>({ tr: "", en: "" });
  const [bilingualErrors, setBilingualErrors] = useState<Partial<Record<"tr" | "en", string>>>({});
  const [draft, setDraft] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // The list is made the way a screen would: filtered, searched, sorted and cut into pages by what is in the address.
  const words = params.q.toLocaleLowerCase("tr");
  const matching = ROWS.filter((row) => (!params.filters.durum || row.status === params.filters.durum) && (!words || `${row.name} ${row.number}`.toLocaleLowerCase("tr").includes(words)));
  const sorted = [...matching].sort((a, b) => {
    const key = (params.sort?.key ?? "number") as keyof Row;
    const order = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
    return params.sort?.dir === "asc" ? order : -order;
  });
  const pageRows = sorted.slice((params.page - 1) * params.pageSize, params.page * params.pageSize);

  const address = (patch: Parameters<typeof hrefQuery<"durum">>[1]) => ({ pathname: "/dev/admin" as const, query: hrefQuery(params, patch, CONFIG) });
  const columns: Column<Row>[] = [
    { key: "number", header: t("colNumber"), sortable: true, cell: (row) => row.number },
    { key: "name", header: t("colName"), sortable: true, cell: (row) => row.name },
    { key: "total", header: t("colTotal"), sortable: true, align: "right", cell: (row) => money.format(row.total / 100) },
    { key: "status", header: t("colStatus"), cell: (row) => <StatusChip tone={TONES[row.status]}>{t(STATUS_KEYS[row.status])}</StatusChip> },
  ];
  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });

  function save() {
    const errors: Partial<Record<"tr" | "en", string>> = {};
    if (!bilingual.tr.trim()) errors.tr = t("missingText");
    if (!bilingual.en.trim()) errors.en = t("missingText");
    setBilingualErrors(errors);
    if (Object.keys(errors).length === 0) toast.show(t("toastDone"));
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-10 md:px-8 xl:py-14">
      <PageHeader title={t("title")} description={t("intro")} action={<Button type="button">{t("save")}</Button>} />

      <section aria-labelledby="g-table" className="flex flex-col gap-4">
        <h2 id="g-table" className="text-h2 text-fg">
          {t("table")}
        </h2>
        <div className="flex flex-col gap-3">
          <FilterChips
            label={t("filterLabel")}
            current={params.filters.durum ?? ""}
            options={[chip("", filterT("all")), chip("CONFIRMED", t("confirmed")), chip("CANCELLED", t("cancelled")), chip("PENDING", t("pending"))]}
          />
          <SearchBox pathname="/dev/admin" query={hrefQuery(params, {}, CONFIG)} value={params.q} label={t("searchLabel")} />
        </div>
        <DataTable
          caption={t("tableCaption")}
          columns={columns}
          rows={pageRows}
          rowKey={(row) => row.number}
          rowHref={() => ({ pathname: "/yonetim" })}
          sort={params.sort}
          sortHref={(key, dir) => address({ sort: { key, dir } })}
          empty={{ title: t("emptyTitle"), text: t("emptyText") }}
        />
        <Pagination page={params.page} pageSize={params.pageSize} total={sorted.length} hrefFor={(page) => address({ page })} />
      </section>

      <section aria-labelledby="g-states" className="flex flex-col gap-4">
        <h2 id="g-states" className="text-h2 text-fg">
          {t("tableStates")}
        </h2>
        <h3 className="text-h3 text-fg">{t("loading")}</h3>
        <DataTable caption={t("loading")} columns={columns} rows={[]} rowKey={(row) => row.number} state="loading" />
        <h3 className="text-h3 text-fg">{t("empty")}</h3>
        <DataTable caption={t("empty")} columns={columns} rows={[]} rowKey={(row) => row.number} empty={{ title: t("emptyTitle"), text: t("emptyText") }} />
        <h3 className="text-h3 text-fg">{t("error")}</h3>
        <DataTable
          caption={t("error")}
          columns={columns}
          rows={[]}
          rowKey={(row) => row.number}
          state="error"
          error={{
            action: (
              <Button asChild variant="outline">
                <Link href={{ pathname: "/dev/admin" }}>{t("retry")}</Link>
              </Button>
            ),
          }}
        />
        <h3 className="text-h3 text-fg">{t("chips")}</h3>
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_KEYS) as Status[]).map((status) => (
            <li key={status}>
              <StatusChip tone={TONES[status]}>{t(STATUS_KEYS[status])}</StatusChip>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="g-forms" className="flex max-w-2xl flex-col gap-6">
        <h2 id="g-forms" className="text-h2 text-fg">
          {t("forms")}
        </h2>
        <BilingualField label={t("bilingualLabel")} name="description" value={bilingual} onChange={setBilingual} errors={bilingualErrors} multiline />
        <p className="text-small text-fg-muted">{t("bilingualHint")}</p>
        <Button type="button" variant="outline" className="self-start" onClick={save}>
          {t("save")}
        </Button>
        <ListField label={t("listLabel")} name="hours" defaultValue={["Pzt–Cum 08:30–19:00", "Cmt 09:00–17:00"]} />
        <FileField label={t("fileLabel")} name="photo" accept="image/jpeg,image/png,image/webp" typesLabel="JPEG, PNG, WebP" maxSizeMb={5} upload={uploadVehicleImage} onUploaded={setPhotoUrl} />
        {photoUrl && <p className="break-all text-small text-fg-muted">{t("uploadedAs", { url: photoUrl })}</p>}
      </section>

      <section aria-labelledby="g-dialogs" className="flex max-w-2xl flex-col gap-4">
        <h2 id="g-dialogs" className="text-h2 text-fg">
          {t("dialogs")}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
            {t("openConfirm")}
          </Button>
          <Button type="button" variant="outline" onClick={() => toast.show(t("toastDone"))}>
            {t("showToast")}
          </Button>
          <Button type="button" variant="outline" onClick={() => toast.show(t("toastFailed"), "error")}>
            {t("showErrorToast")}
          </Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title={t("confirmTitle")}
          text={t("confirmText")}
          confirmLabel={t("confirmAction")}
          pending={confirmPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmPending(true);
            setTimeout(() => {
              setConfirmPending(false);
              setConfirmOpen(false);
              toast.show(t("toastDone"));
            }, 600);
          }}
        />
        <h3 className="text-h3 text-fg">{t("stale")}</h3>
        <StaleWriteBanner onReload={() => toast.show(t("toastDone"))} />
        <h3 className="text-h3 text-fg">{t("unsaved")}</h3>
        <label htmlFor="g-draft" className="text-label text-fg">
          {t("unsavedField")}
        </label>
        <Input id="g-draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Link href="/yonetim" className="inline-flex min-h-11 items-center self-start text-link underline underline-offset-4">
          {t("unsavedLink")}
        </Link>
        <UnsavedChangesGuard dirty={draft !== ""} />
      </section>
    </div>
  );
}
