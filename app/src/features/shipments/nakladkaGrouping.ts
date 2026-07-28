// Grouping of the loading list into sections by product kind.
//
// The van is packed by kind, not by client: crates and cans go in first, kegs
// last, so the list is read out in that order. Kept out of ShipmentDetail so the
// ordering can be checked without a rendering harness.

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
