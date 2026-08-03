// Grouping of the loading list: brewery first, product kind inside it.
//
// The pallet is collected brewery by brewery, and within one brewery the van is
// packed by kind, not by client: crates and cans go in first, kegs last, so the
// list is read out in that order. Kept out of ShipmentDetail so the ordering can
// be checked without a rendering harness.

import type { ProductKind, ProductType } from 'src/generated/api-client';
import { kindLabel, kindName } from 'src/lib/labels';
import { compareProductsForDisplay } from 'src/lib/productSort';

/**
 * Section order, as the van is loaded: bottles, cans, multipacks, everything else,
 * kegs last.
 */
export const KIND_ORDER = ['Bottle', 'Can', 'Multipack', 'Other', 'Keg'] as const;

/** Anything without a recognised kind is read out with the odds and ends. */
const FALLBACK_KIND = 'Other';

export interface KindSection<T> {
  /** Enum member name of the kind, or "Other". */
  kind: string;
  /** Czech section heading. */
  label: string;
  rows: T[];
}

/** What a row needs for the within-section order. */
interface Sortable {
  type?: ProductType;
  platoDegree?: number;
  packageSize?: number;
  name?: string;
}

/**
 * Within a section: the app-wide product order — by degree, smallest package
 * first, soft drinks at the end.
 *
 * The section is already one kind, so this only decides the order inside it. A
 * row with no degree sorts after the beers rather than in front of them: a
 * missing value is not a zero-degree beer, it is something else (cider kegs,
 * empties). {@link compareProductsForDisplay} also drops the limonády below
 * those, which is what the customer asked for.
 */
function bySortKey(a: Sortable, b: Sortable): number {
  return compareProductsForDisplay(a, b);
}

/**
 * Splits rows into sections in {@link KIND_ORDER}, dropping the empty ones, each
 * sorted by degree and then package size.
 *
 * Kinds are matched by enum *name*, because the API serialises them as strings while
 * the generated enum is numeric.
 */
export function groupByKind<T extends { kind?: ProductKind | string | number } & Sortable>(
  rows: T[],
): KindSection<T>[] {
  const buckets = new Map<string, T[]>();

  for (const row of rows) {
    const name = kindName(row.kind);
    const key = name && (KIND_ORDER as readonly string[]).includes(name) ? name : FALLBACK_KIND;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  return KIND_ORDER
    .filter((kind) => (buckets.get(kind)?.length ?? 0) > 0)
    .map((kind) => ({
      kind,
      label: kindLabel(kind) ?? kind,
      rows: [...buckets.get(kind)!].sort(bySortKey),
    }));
}

/** What a row needs to be placed under a brewery. */
export interface Supplied {
  breweryId?: string;
  breweryName?: string;
  /** The brewery's own display order, which is what the sections are ordered by. */
  breweryDisplayOrder?: number;
}

/** One brewery's part of the loading list. */
export interface BrewerySection<T> {
  /** Public ID of the brewery, or "" for rows that name none. */
  breweryId: string;
  /** Brewery name — the section heading. */
  label: string;
  /** Every row of the brewery, for the heading's item count. */
  rows: T[];
  /** Those rows split by kind, in {@link KIND_ORDER}. */
  kinds: KindSection<T>[];
}

/** Heading for rows whose brewery did not come through. Defensive: the server fills it. */
const UNKNOWN_BREWERY_LABEL = 'Bez pivovaru';

/**
 * Splits rows into one section per brewery, each split again by kind.
 *
 * Brewery order is the app-wide one — the brewery's own `displayOrder`, the same key the
 * backend sorts its product lists by — so the sections read the same here as in the
 * catalogue. Two breweries sharing an order fall back to their names; a row with no
 * brewery at all lands in a section of its own, last.
 *
 * Aggregated rows arrive in stop order, so first-appearance is not a usable section order:
 * which brewery leads would depend on whose order happens to be the first stop.
 */
export function groupByBreweryThenKind<
  T extends { kind?: ProductKind | string | number } & Sortable & Supplied,
>(rows: T[]): BrewerySection<T>[] {
  const buckets = new Map<string, T[]>();

  for (const row of rows) {
    const key = row.breweryId ?? '';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  // The display order is a sort key only, so it rides alongside the section rather than on
  // it. It comes off the rows because the brewery itself is not loaded here; every row of
  // one brewery carries the same value.
  const sections = [...buckets].map(([breweryId, breweryRows]) => ({
    displayOrder: breweryRows.find((r) => r.breweryDisplayOrder != null)?.breweryDisplayOrder,
    section: {
      breweryId,
      label: breweryRows.find((r) => r.breweryName)?.breweryName ?? UNKNOWN_BREWERY_LABEL,
      rows: breweryRows,
      kinds: groupByKind(breweryRows),
    } satisfies BrewerySection<T>,
  }));

  return sections
    .sort((a, b) => {
      const byOrder = (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity);
      if (byOrder !== 0) return byOrder;
      return a.section.label.localeCompare(b.section.label, 'cs');
    })
    .map((entry) => entry.section);
}
