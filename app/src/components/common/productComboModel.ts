// Shaping logic behind ProductCombobox: turns a flat product list into the
// two-level catalog the delivery/order editors render (brewery → product name →
// size variants), flattened into the single row array an Autocomplete listbox
// needs. Kept pure and separate so the grouping, collapse and search rules can
// be tested without a rendering harness.

import { fmtLiters } from 'src/lib/format';
import { compareKindThenSize } from 'src/lib/productSort';
import { type ProductListItemDto } from 'src/generated/api-client';

/**
 * A row on its way in or out of view. 'out' rows belong to a group that was
 * just collapsed: they are kept in the list for the length of the animation so
 * there is something to animate, and rendered inert until they go.
 */
export type RowMotion = 'in' | 'out';

export interface BreweryHeadRow {
  type: 'brewery';
  key: string;
  breweryId?: string;
  breweryName: string;
  /** Products under this brewery *after* the search filter. */
  count: number;
  collapsed: boolean;
}

export interface NameHeadRow {
  type: 'name';
  key: string;
  breweryId?: string;
  name: string;
  /** Size variants sharing this name; always > 1 (a lone variant gets no head). */
  count: number;
  collapsed: boolean;
  motion?: RowMotion;
}

export interface ProductRow {
  type: 'product';
  key: string;
  product: ProductListItemDto;
  breweryId?: string;
  /** No name head above it, so the row has to carry the product name itself. */
  standalone: boolean;
  motion?: RowMotion;
}

export type ComboRow = BreweryHeadRow | NameHeadRow | ProductRow;

export const NO_BREWERY = 'Bez pivovaru';

export function breweryKey(p: ProductListItemDto): string {
  return `b:${p.breweryId ?? p.breweryName ?? NO_BREWERY}`;
}

export function nameKey(p: ProductListItemDto): string {
  return `${breweryKey(p)}|n:${p.name ?? ''}`;
}

/** What the closed input shows once a product is picked. */
export function productComboLabel(p: ProductListItemDto): string {
  const size = p.packageSize != null ? ` (${fmtLiters(p.packageSize)})` : '';
  const brewery = p.breweryName ? ` — ${p.breweryName}` : '';
  return `${p.name ?? '—'}${size}${brewery}`;
}

/** Matches on product and brewery name — the two things a user types here. */
export function matchesProductSearch(p: ProductListItemDto, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return `${p.name ?? ''} ${p.breweryName ?? ''}`.toLowerCase().includes(q);
}

/**
 * Flattens products into listbox rows.
 *
 * Group order is first-seen order in `products` — the API already returns them
 * sorted by `breweryDisplayOrder`/`displayOrder`, same assumption DeliveryEditor
 * makes. Breweries left with no match are dropped entirely rather than rendering
 * an empty header, and while a search is active `collapsed` is ignored: hiding
 * the only hit behind a collapsed group would look like "nothing found".
 *
 * `motion` marks the groups mid-animation, keyed the same way as `collapsed`. A
 * collapsed group listed as 'out' keeps its children one last time so they can
 * animate away; an expanded group listed as 'in' has its children marked for the
 * entry animation. The caller drops the entry once the animation is over.
 */
export function buildRows(
  products: ProductListItemDto[],
  { collapsed, search, motion }: {
    collapsed: ReadonlySet<string>;
    search: string;
    motion?: ReadonlyMap<string, RowMotion>;
  },
): ComboRow[] {
  const searching = search.trim().length > 0;
  const isCollapsed = (key: string) => !searching && collapsed.has(key);
  // A group only animates in its own direction: an expanded group is never
  // 'out', so a stale entry can't resurrect rows.
  const motionOf = (key: string, groupCollapsed: boolean): RowMotion | undefined => {
    if (searching) return undefined;
    const m = motion?.get(key);
    return m === (groupCollapsed ? 'out' : 'in') ? m : undefined;
  };

  const order: string[] = [];
  const byBrewery = new Map<string, ProductListItemDto[]>();
  for (const p of products) {
    if (!matchesProductSearch(p, search)) continue;
    const key = breweryKey(p);
    if (!byBrewery.has(key)) { byBrewery.set(key, []); order.push(key); }
    byBrewery.get(key)!.push(p);
  }

  const rows: ComboRow[] = [];
  for (const bKey of order) {
    const items = byBrewery.get(bKey)!;
    const bCollapsed = isCollapsed(bKey);
    const bMotion = motionOf(bKey, bCollapsed);
    rows.push({
      type: 'brewery',
      key: bKey,
      breweryId: items[0].breweryId,
      breweryName: items[0].breweryName || NO_BREWERY,
      count: items.length,
      collapsed: bCollapsed,
    });
    // Collapsed and not animating out — the children are simply gone.
    if (bCollapsed && bMotion !== 'out') continue;

    const nameOrder: string[] = [];
    const byName = new Map<string, ProductListItemDto[]>();
    for (const p of items) {
      const key = nameKey(p);
      if (!byName.has(key)) { byName.set(key, []); nameOrder.push(key); }
      byName.get(key)!.push(p);
    }

    for (const nKey of nameOrder) {
      const variants = byName.get(nKey)!.slice().sort(compareKindThenSize);
      if (variants.length === 1) {
        rows.push({
          type: 'product',
          key: variants[0].id ?? nKey,
          product: variants[0],
          breweryId: variants[0].breweryId,
          standalone: true,
          motion: bMotion,
        });
        continue;
      }
      const nCollapsed = isCollapsed(nKey);
      rows.push({
        type: 'name',
        key: nKey,
        breweryId: variants[0].breweryId,
        name: variants[0].name ?? '—',
        count: variants.length,
        collapsed: nCollapsed,
        motion: bMotion,
      });
      // Inside a brewery that is animating, every row moves with it; otherwise
      // the name group answers for itself.
      const nMotion = bMotion ?? motionOf(nKey, nCollapsed);
      if (nCollapsed && nMotion !== 'out') continue;
      for (const v of variants) {
        rows.push({
          type: 'product',
          key: v.id ?? `${nKey}|${v.packageSize ?? ''}`,
          product: v,
          breweryId: v.breweryId,
          standalone: false,
          motion: nMotion,
        });
      }
    }
  }
  return rows;
}
