// The ordering rules for products, shared by every surface that puts them in a
// list. Mirrors the backend's ProductOrdering — the server already returns its
// lists in this order, and these are for the screens that regroup the rows
// themselves and so have to re-sort.

import { ProductType, type ProductKind } from 'src/generated/api-client';
import { KIND_ORDER, kindName } from './labels';

/** The bits of a product (or an inventory row) the ordering depends on. */
export interface KindAndSize {
  kind?: ProductKind;
  packageSize?: number;
}

/**
 * Kind first, in the app-wide {@link KIND_ORDER} (sud → basa → plechovka → …),
 * then package size ascending, so the sizes of one kind read as a ladder.
 * Unknown kind or size sorts last within its level; ties keep their order.
 */
export function compareKindThenSize(a: KindAndSize, b: KindAndSize): number {
  const rank = (x: KindAndSize) => KIND_ORDER[kindName(x.kind) ?? ''] ?? 99;
  const byKind = rank(a) - rank(b);
  if (byKind !== 0) return byKind;
  return (a.packageSize ?? Infinity) - (b.packageSize ?? Infinity);
}

/** The bits the display order depends on. */
export interface DisplayOrderable {
  type?: ProductType;
  platoDegree?: number;
  packageSize?: number;
  name?: string;
}

/**
 * Not beer, and therefore last: limonáda, merch, ostatní. Nealko and radler are
 * absent on purpose — they are beer, they just carry no degree.
 */
export function isNonBeer(type?: ProductType): boolean {
  return type === ProductType.Lemonade
    || type === ProductType.Merchandise
    || type === ProductType.Other;
}

/**
 * The app-wide product order the customer asked for: by degree (stupňovitost),
 * with the soft drinks at the end.
 *
 * Beer first, ordered by degree and then package size; everything that is not
 * beer after it. A beer with no degree recorded sorts after the degreed ones but
 * still ahead of the limonády. An unknown type counts as beer — a product whose
 * type never got filled in is far more likely to be one, and burying it under the
 * merch would hide it.
 */
export function compareProductsForDisplay(a: DisplayOrderable, b: DisplayOrderable): number {
  const byRank = Number(isNonBeer(a.type)) - Number(isNonBeer(b.type));
  if (byRank !== 0) return byRank;

  const byMissingDegree = Number(a.platoDegree == null) - Number(b.platoDegree == null);
  if (byMissingDegree !== 0) return byMissingDegree;

  const byDegree = (a.platoDegree ?? 0) - (b.platoDegree ?? 0);
  if (byDegree !== 0) return byDegree;

  const bySize = (a.packageSize ?? Infinity) - (b.packageSize ?? Infinity);
  if (bySize !== 0) return bySize;

  return (a.name ?? '').localeCompare(b.name ?? '', 'cs');
}
