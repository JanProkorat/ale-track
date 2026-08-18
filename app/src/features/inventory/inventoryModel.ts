// The sklad list arrives one row per product *variant*, so the same beer shows
// up several times over — once per keg size. This folds the variants of one
// product back together for display; the rows themselves stay separate, because
// each has its own quantity, note and delete.

import { compareKindThenSize } from 'src/lib/productSort';
import { fmtLiters } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { type InventoryItemListItemDto } from 'src/generated/api-client';

/** An item is "low stock" only when it's linked to a catalog product — free/manual
 * entries never carry the warning (matches the prototype's `i.productId && qty<=3`). */
export function isLow(item: InventoryItemListItemDto): boolean {
  return Boolean(item.productId) && (item.quantity ?? 0) <= 3;
}

/** Kind + package size, the line that tells two variants of a product apart.
 *
 * A supplier's goods have neither: no ProductKind, and a size the supplier states as free text
 * ("10 kg", "20 ks") rather than a litre volume. They read by that size instead, so the line is
 * never blank on a row the warehouse actually holds. */
export function itemSubtitle(item: InventoryItemListItemDto): string {
  if (item.supplierGoodId) return item.size ?? '';
  return [kindLabel(item.kind), fmtLiters(item.packageSize)].filter(Boolean).join(' · ');
}

export interface InventoryGroup {
  key: string;
  name: string;
  /** Variants of this product, ordered by kind then size. */
  items: InventoryItemListItemDto[];
}

/**
 * Groups the items of one brewery section by product name, in first-seen order
 * (a group takes the position of its first variant).
 *
 * Only product-backed rows group: a manual item is free text with no size to
 * tell it apart, so two of them sharing a name are still two separate things
 * and each keeps its own group.
 */
export function groupInventoryItems(items: InventoryItemListItemDto[]): InventoryGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, InventoryItemListItemDto[]>();

  for (const item of items) {
    const key = item.productId ? `n:${item.name ?? ''}` : `i:${item.id ?? ''}`;
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
    byKey.get(key)!.push(item);
  }

  return order.map((key) => {
    const group = byKey.get(key)!;
    return {
      key,
      name: group[0].name ?? '—',
      items: group.length > 1 ? group.slice().sort(compareKindThenSize) : group,
    };
  });
}
