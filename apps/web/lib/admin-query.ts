// The address of a panel list and the query the API wants (ADMIN.md §3.4, ADR-24). The address is what a person can
// share (`?durum=CONFIRMED&sayfa=2`), so it stays in Turkish; the API's own names are `page`, `pageSize`, `sort`, `q`.
// Everything read from the address is checked here against what the list says it allows, so a made-up value never
// reaches the API: it falls back to the default instead of becoming an error page.

export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir };
type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

export type AdminListConfig<F extends string = string> = {
  // The keys a list can be sorted by (the API's field names).
  sortable: readonly string[];
  defaultSort?: Sort;
  // Filters: the name in the address, and the values it may take (null: free text, up to 100 characters).
  filters?: Record<F, readonly string[] | null>;
  // 20 unless the list says otherwise; never more than 100 (the API's limit).
  pageSize?: number;
};

export type AdminListParams<F extends string = string> = {
  page: number;
  pageSize: number;
  sort: Sort | null;
  q: string;
  filters: Partial<Record<F, string>>;
};

export const ADDRESS = { page: "sayfa", sort: "sirala", search: "ara" } as const;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
const MAX_TEXT = 100;
const MAX_PAGE = 100_000;
const SORT = /^([A-Za-z][A-Za-z0-9_.]{0,63}):(asc|desc)$/;

function first(raw: Raw, name: string): string | undefined {
  const value = raw instanceof URLSearchParams ? (raw.get(name) ?? undefined) : raw[name];
  return Array.isArray(value) ? value[0] : value;
}

const cleanText = (value: string | undefined): string => (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);

export function parseAdminListParams<F extends string>(raw: Raw, config: AdminListConfig<F>): AdminListParams<F> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(config.pageSize ?? DEFAULT_PAGE_SIZE)));

  const pageText = first(raw, ADDRESS.page);
  const page = pageText && /^\d{1,6}$/.test(pageText) ? Math.min(MAX_PAGE, Math.max(1, Number(pageText))) : 1;

  let sort: Sort | null = config.defaultSort ?? null;
  const sortMatch = SORT.exec(first(raw, ADDRESS.sort) ?? "");
  if (sortMatch && config.sortable.includes(sortMatch[1]!)) sort = { key: sortMatch[1]!, dir: sortMatch[2] as SortDir };

  const filters: Partial<Record<F, string>> = {};
  for (const [name, allowed] of Object.entries(config.filters ?? {}) as Array<[F, readonly string[] | null]>) {
    const value = cleanText(first(raw, name));
    if (value === "") continue;
    if (allowed === null || allowed.includes(value)) filters[name] = value;
  }

  return { page, pageSize, sort, q: cleanText(first(raw, ADDRESS.search)), filters };
}

// The query for the API: its names, and only what was set.
export function toApiQuery<F extends string>(
  params: AdminListParams<F>,
  // A filter whose API name differs from its name in the address (`durum` → `status`).
  filterNames: Partial<Record<F, string>> = {},
): URLSearchParams {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.sort) query.set("sort", `${params.sort.key}:${params.sort.dir}`);
  if (params.q) query.set("q", params.q);
  for (const [name, value] of Object.entries(params.filters) as Array<[F, string]>) {
    query.set(filterNames[name] ?? name, value);
  }
  return query;
}

export type Patch<F extends string> = {
  page?: number;
  sort?: Sort | null;
  q?: string;
  // `null` removes a filter.
  filters?: Partial<Record<F, string | null>>;
};

// The address after a change, as a query object for a link. Anything but a page change starts again from page 1, and
// what is the default (page 1, the default sort, nothing typed) is left out, so the shared address stays short.
export function hrefQuery<F extends string>(
  params: AdminListParams<F>,
  patch: Patch<F>,
  config: Pick<AdminListConfig<F>, "defaultSort"> = {},
): Record<string, string> {
  const next = {
    sort: "sort" in patch ? patch.sort : params.sort,
    q: patch.q ?? params.q,
    filters: { ...params.filters } as Partial<Record<F, string>>,
  };
  for (const [name, value] of Object.entries(patch.filters ?? {}) as Array<[F, string | null]>) {
    if (value === null || value === "") delete next.filters[name];
    else next.filters[name] = value;
  }
  const changedSomethingElse = "sort" in patch || patch.q !== undefined || patch.filters !== undefined;
  const page = patch.page ?? (changedSomethingElse ? 1 : params.page);

  const out: Record<string, string> = {};
  if (page > 1) out[ADDRESS.page] = String(page);
  const dflt = config.defaultSort;
  if (next.sort && !(dflt && next.sort.key === dflt.key && next.sort.dir === dflt.dir)) {
    out[ADDRESS.sort] = `${next.sort.key}:${next.sort.dir}`;
  }
  if (next.q) out[ADDRESS.search] = next.q;
  for (const [name, value] of Object.entries(next.filters) as Array<[string, string]>) out[name] = value;
  return out;
}

// How many pages there are (at least one, so an empty list still has a "page 1").
export const pageCount = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / pageSize));

// Which page numbers are shown: the first, the last, the current and its two neighbours, with a gap marked as `null`.
export function pageWindow(page: number, pages: number): Array<number | null> {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  shown.forEach((n, index) => {
    if (index > 0 && n - shown[index - 1]! > 1) out.push(null);
    out.push(n);
  });
  return out;
}

