// Shaping logic behind the order editor's product catalog: puts a flat product
// list into the app-wide display order and clusters same-name size variants into
// one card. Kept out of OrderEditor.tsx so the ordering rules can be tested
// without a rendering harness.

import { compareProductsForDisplay } from 'src/lib/productSort';
import { type ProductListItemDto } from 'src/generated/api-client';

/** Same-name products, one card, one row per size variant. */
export interface NameGroup {
  name: string;
  items: ProductListItemDto[];
}

/**
 * Puts products into the app-wide display order — beer by degree then package
 * size, soft drinks last.
 *
 * Both catalog tabs need this. "Procházet dle pivovaru" gets its products from a
 * brewery → kind → package-size nesting, so flattening it would order them by
 * kind; "Dříve objednané" gets a flat `recent` array whose order is the
 * projection's, not the catalog's. Re-sorting is what makes the two tabs agree.
 */
export function inDisplayOrder(products: ProductListItemDto[]): ProductListItemDto[] {
  return products.slice().sort(compareProductsForDisplay);
}

/**
 * Groups a flat product list by name so same-name/different-size variants
 * cluster into one card, in first-seen order — mirrors the prototype's
 * oeGroupList grouping.
 *
 * First-seen order is what carries {@link inDisplayOrder} through: sort first,
 * and the groups come out in display order too.
 *
 * Keyed on the name alone, so two breweries' identically-named beers land in one
 * group. Pre-existing behaviour, kept deliberately — splitting them needs a
 * brewery heading the flat list does not have.
 */
export function groupByName(products: ProductListItemDto[]): NameGroup[] {
  const order: string[] = [];
  const byName = new Map<string, ProductListItemDto[]>();
  for (const p of products) {
    const name = p.name ?? '';
    if (!byName.has(name)) { byName.set(name, []); order.push(name); }
    byName.get(name)!.push(p);
  }
  return order.map((name) => ({ name, items: byName.get(name)! }));
}
