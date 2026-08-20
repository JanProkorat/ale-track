import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compareSortValues,
  sortRows,
  clampPage,
  pageSlice,
  readStoredPageSize,
  storePageSize,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from './dataTableModel';

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('compareSortValues — Czech collation', () => {
  it('orders č after c, which an English collation gets wrong', () => {
    // The whole reason for the explicit 'cs' locale. Czech treats č as its own letter after
    // c, so "cukr" precedes "čaj". An English collation folds č onto c and compares the
    // next letter instead, putting "čaj" first — if ICU ever loses the Czech locale this is
    // the assertion that catches it rather than users noticing a mis-sorted list.
    expect(compareSortValues('cukr', 'čaj', 'asc')).toBeLessThan(0);
  });

  it('orders the Czech alphabet correctly through a full sort', () => {
    const rows = [{ name: 'čaj' }, { name: 'cukr' }, { name: 'chleba' }, { name: 'dům' }, { name: 'hora' }];

    // Czech: c < č < d < h < ch — "chleba" sorts after "hora", not next to "cukr".
    expect(names(sortRows(rows, (r) => r.name, 'asc'))).toEqual(['cukr', 'čaj', 'dům', 'hora', 'chleba']);
  });

  it('compares embedded numbers numerically, not lexically', () => {
    // Lexical ordering would put "Vůz 10" before "Vůz 2".
    expect(compareSortValues('Vůz 2', 'Vůz 10', 'asc')).toBeLessThan(0);
  });

  it('is case-insensitive about which of two spellings wins', () => {
    expect(compareSortValues('adam', 'Beta', 'asc')).toBeLessThan(0);
  });
});

describe('compareSortValues — blanks', () => {
  it('sorts blanks last ascending AND descending', () => {
    // Flipping blanks to the top on a descending sort would bury real rows under "—".
    for (const direction of ['asc', 'desc'] as const) {
      expect(compareSortValues(null, 'a', direction)).toBeGreaterThan(0);
      expect(compareSortValues(undefined, 'a', direction)).toBeGreaterThan(0);
      expect(compareSortValues('', 'a', direction)).toBeGreaterThan(0);
      expect(compareSortValues('a', null, direction)).toBeLessThan(0);
    }
  });

  it('treats two blanks as equal', () => {
    expect(compareSortValues(null, undefined, 'asc')).toBe(0);
  });

  it('treats NaN and an invalid Date as blank rather than poisoning the sort', () => {
    // A NaN comparison returns NaN, which makes Array#sort's result unspecified — one bad
    // row could scramble the entire list, so these must be pinned.
    expect(compareSortValues(Number.NaN, 5, 'asc')).toBeGreaterThan(0);
    expect(compareSortValues(new Date('nope'), new Date('2026-01-01'), 'asc')).toBeGreaterThan(0);
  });

  it('keeps blanks last through a real sort, in both directions', () => {
    const rows = [{ name: 'b' }, { name: '' }, { name: 'a' }];

    expect(names(sortRows(rows, (r) => r.name, 'asc'))).toEqual(['a', 'b', '']);
    expect(names(sortRows(rows, (r) => r.name, 'desc'))).toEqual(['b', 'a', '']);
  });
});

describe('compareSortValues — numbers and dates', () => {
  it('compares numbers by magnitude', () => {
    expect(compareSortValues(2, 10, 'asc')).toBeLessThan(0);
    expect(compareSortValues(2, 10, 'desc')).toBeGreaterThan(0);
  });

  it('compares dates chronologically', () => {
    const older = new Date('2026-01-01');
    const newer = new Date('2026-07-01');

    expect(compareSortValues(older, newer, 'asc')).toBeLessThan(0);
    expect(compareSortValues(older, newer, 'desc')).toBeGreaterThan(0);
  });

  it('orders an undated row last either way — the orders list depends on this', () => {
    const rows = [
      { name: 'undated', createdDate: undefined },
      { name: 'old', createdDate: new Date('2026-01-01') },
      { name: 'new', createdDate: new Date('2026-07-01') },
    ];

    // Newest-first, which is the orders list's default, with the undated row still last.
    expect(names(sortRows(rows, (r) => r.createdDate, 'desc'))).toEqual(['new', 'old', 'undated']);
  });
});

describe('sortRows', () => {
  it('does not mutate the input — the array comes from the query cache', () => {
    const rows = [{ name: 'b' }, { name: 'a' }];

    sortRows(rows, (r) => r.name, 'asc');

    expect(names(rows)).toEqual(['b', 'a']);
  });

  it('keeps the incoming order among equal values', () => {
    const rows = [
      { name: 'x', group: 'a' },
      { name: 'y', group: 'a' },
      { name: 'z', group: 'a' },
    ];

    expect(names(sortRows(rows, (r) => r.group, 'asc'))).toEqual(['x', 'y', 'z']);
  });

  it('handles an empty list', () => {
    expect(sortRows([], (r: { name: string }) => r.name, 'asc')).toEqual([]);
  });
});

describe('clampPage', () => {
  it('holds a page inside the range the row count allows', () => {
    // 25 rows at 10 per page is pages 0..2.
    expect(clampPage(5, 25, 10)).toBe(2);
    expect(clampPage(1, 25, 10)).toBe(1);
  });

  it('collapses to the first page when the rows are gone — the filter-while-paged case', () => {
    expect(clampPage(5, 0, 10)).toBe(0);
    expect(clampPage(5, 3, 10)).toBe(0);
  });

  it('never returns a negative page', () => {
    expect(clampPage(-2, 25, 10)).toBe(0);
  });
});

describe('pageSlice', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ name: `row-${i}` }));

  it('returns exactly one page of rows', () => {
    expect(pageSlice(rows, 0, 10)).toHaveLength(10);
    expect(names(pageSlice(rows, 0, 10))[0]).toBe('row-0');
    expect(names(pageSlice(rows, 1, 10))[0]).toBe('row-10');
  });

  it('returns the remainder on a short last page', () => {
    expect(pageSlice(rows, 2, 10)).toHaveLength(5);
  });

  it('falls back to the last page rather than nothing when the page is out of range', () => {
    expect(names(pageSlice(rows, 99, 10))[0]).toBe('row-20');
  });
});

/** A working Storage. The test environment does NOT provide one: under happy-dom here,
 * `localStorage` is a bare object whose getItem/setItem are `undefined`, so touching it
 * throws a TypeError (Node's experimental --localstorage-file stub with no path). That is
 * exactly the hostile case `readStoredPageSize` guards, and it is covered on its own below —
 * but the round-trip behaviour needs a real store to be observable at all. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
  };
}

describe('page-size preference', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to ten rows', () => {
    expect(readStoredPageSize('orders')).toBe(DEFAULT_PAGE_SIZE);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it('round-trips a remembered choice', () => {
    storePageSize('orders', 25);

    expect(readStoredPageSize('orders')).toBe(25);
  });

  it('keeps each list independent — 50 on one must not set 50 on the others', () => {
    storePageSize('orders', 50);

    expect(readStoredPageSize('orders')).toBe(50);
    expect(readStoredPageSize('clients')).toBe(DEFAULT_PAGE_SIZE);
    expect(readStoredPageSize('shipments')).toBe(DEFAULT_PAGE_SIZE);
  });

  it('remembers a separate choice per list', () => {
    storePageSize('orders', 50);
    storePageSize('clients', 25);

    expect(readStoredPageSize('orders')).toBe(50);
    expect(readStoredPageSize('clients')).toBe(25);
  });

  it('remembers nothing for a table that does not identify itself', () => {
    // No key means no shared anonymous bucket to leak through.
    storePageSize(undefined, 50);

    expect(readStoredPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('ignores a stored value that is not one of the offered options', () => {
    // The value feeds MUI's rowsPerPageOptions; an unlisted size renders a blank select.
    localStorage.setItem('aletrack.table.pageSize.orders', '37');
    expect(readStoredPageSize('orders')).toBe(DEFAULT_PAGE_SIZE);

    localStorage.setItem('aletrack.table.pageSize.orders', 'nonsense');
    expect(readStoredPageSize('orders')).toBe(DEFAULT_PAGE_SIZE);
  });

  it('offers exactly the four sizes asked for', () => {
    expect([...PAGE_SIZE_OPTIONS]).toEqual([10, 25, 50, 100]);
  });
});

describe('page-size preference when storage is unavailable', () => {
  // Not a hypothetical: this is the state of `localStorage` in this very test environment,
  // and it is also what a browser with site-data blocked does. Losing the preference is
  // acceptable; throwing out of a table render is not.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the default when reading throws', () => {
    vi.stubGlobal('localStorage', {});

    expect(readStoredPageSize('orders')).toBe(DEFAULT_PAGE_SIZE);
  });

  it('swallows a failed write rather than breaking the caller', () => {
    vi.stubGlobal('localStorage', {});

    expect(() => storePageSize('orders', 50)).not.toThrow();
  });

  it('survives a store that throws outright, as a quota-exceeded one does', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('access denied');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
    });

    expect(readStoredPageSize('orders')).toBe(DEFAULT_PAGE_SIZE);
    expect(() => storePageSize('orders', 50)).not.toThrow();
  });
});
