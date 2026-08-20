// Pure shaping for DataTable's sorting and paging: comparators, page arithmetic, and the
// persisted rows-per-page preference. Kept out of the component so the ordering rules are
// testable without a rendering harness — see app/CLAUDE.md's convention for model modules
// next to the thing they serve (shipmentInvoiceModel.ts, reportModel.ts).

export type SortDirection = 'asc' | 'desc';

/** Which column is sorted and which way. `key` matches a `Column.key`. */
export interface SortState {
  key: string;
  direction: SortDirection;
}

/** What a column can be sorted by. `render` returns a ReactNode, which cannot be compared,
 * so a sortable column supplies one of these instead. */
export type SortValue = string | number | Date | null | undefined;

/** The UI is Czech, so ordering must be too: Czech treats č/ř/š as their own letters, and a
 * default (English) collation folds them onto c/r/s and orders words wrongly. `numeric` so
 * "Vůz 2" precedes "Vůz 10" rather than sorting lexically. Built once — constructing a
 * Collator per comparison is measurably slower on a long list. */
const COLLATOR = new Intl.Collator('cs', { numeric: true });

/** Values with nothing to order by. Includes the empty string (a rendered "—" placeholder is
 * usually backed by one) and the degenerate numbers/dates, so a NaN cannot make the
 * comparator non-deterministic and corrupt the whole sort. */
function isBlank(value: SortValue): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime());
  }
  return false;
}

/** Orders two column values.
 *
 * Blanks always sort last, in BOTH directions — flipping them to the top on a descending
 * sort would bury the rows the user is looking for under a block of "—". This is also what
 * keeps the orders list's undated rows at the bottom either way. */
export function compareSortValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank || bBlank) {
    if (aBlank && bBlank) {
      return 0;
    }
    return aBlank ? 1 : -1;
  }

  const factor = direction === 'desc' ? -1 : 1;

  if (a instanceof Date && b instanceof Date) {
    return factor * (a.getTime() - b.getTime());
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return factor * (a - b);
  }
  return factor * COLLATOR.compare(String(a), String(b));
}

/** Sorts a copy of `rows` by one column's value. Never mutates the input — the array comes
 * straight from the query cache, and sorting it in place would reorder cached data.
 *
 * Rows comparing equal keep their incoming order (Array#sort is stable per spec), so a
 * secondary ordering already applied by the caller survives. */
export function sortRows<T>(
  rows: readonly T[],
  sortValue: (row: T) => SortValue,
  direction: SortDirection
): T[] {
  return [...rows].sort((a, b) => compareSortValues(sortValue(a), sortValue(b), direction));
}

/** Holds a page index inside the range the current row count allows.
 *
 * Needed because the row set shrinks underneath the pager: filtering a list down while on
 * page 5 would otherwise render an empty table with no obvious way back. */
export function clampPage(page: number, rowCount: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 0;
  }
  const lastPage = Math.max(0, Math.ceil(rowCount / pageSize) - 1);
  return Math.min(Math.max(0, page), lastPage);
}

/** The rows visible on a page, clamped so an out-of-range page yields the last page's rows
 * rather than nothing. */
export function pageSlice<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) {
    return [...rows];
  }
  const start = clampPage(page, rows.length, pageSize) * pageSize;
  return rows.slice(start, start + pageSize);
}

export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

export const DEFAULT_PAGE_SIZE = 10;

/** Namespace for the remembered rows-per-page. Deliberately suffixed with a per-list key
 * rather than shared app-wide: the lists are different shapes and are read differently, so
 * choosing 50 on the orders list must not silently set 50 on every other list too. */
const PAGE_SIZE_STORAGE_PREFIX = 'aletrack.table.pageSize';

function pageSizeStorageKey(tableKey: string): string {
  return `${PAGE_SIZE_STORAGE_PREFIX}.${tableKey}`;
}

/** The rows-per-page remembered for one list, or the default when nothing valid is stored.
 *
 * Without a `tableKey` nothing is remembered at all — a table that does not identify itself
 * gets the default rather than sharing an anonymous bucket with unrelated tables.
 *
 * Anything unrecognised falls back rather than being trusted: the value reaches the pager's
 * `rowsPerPageOptions`, and a stored size that is not one of the options makes MUI's select
 * render a blank value. Storage access is guarded because it throws outright in a browser
 * with cookies/site-data blocked, and a lost preference must never break the table. */
export function readStoredPageSize(tableKey?: string): number {
  if (!tableKey) {
    return DEFAULT_PAGE_SIZE;
  }
  try {
    const stored = Number(localStorage.getItem(pageSizeStorageKey(tableKey)));
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

/** Remembers one list's rows-per-page choice. Best-effort: see `readStoredPageSize`. */
export function storePageSize(tableKey: string | undefined, pageSize: number): void {
  if (!tableKey) {
    return;
  }
  try {
    localStorage.setItem(pageSizeStorageKey(tableKey), String(pageSize));
  } catch {
    // A blocked store only costs the preference, so there is nothing to recover from here.
  }
}
