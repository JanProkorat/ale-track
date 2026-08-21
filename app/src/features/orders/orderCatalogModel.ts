// Shaping logic behind the order editor's product catalog: puts a flat product
// list into the app-wide display order and clusters same-name size variants into
// one card. Kept out of OrderEditor.tsx so the ordering rules can be tested
// without a rendering harness.

import { compareProductsForDisplay } from 'src/lib/productSort';
import {
  BreweryGroupDto, KindGroupDto, PackageGroupDto, type ProductListItemDto,
} from 'src/generated/api-client';

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

/**
 * Nests a flat product list into the brewery → kind → package-size shape the
 * "Procházet dle pivovaru" tab reads.
 *
 * That tab normally gets the nesting from the client-history endpoint, which is
 * disabled until a client is chosen — yet the catalog itself does not depend on the
 * client. This rebuilds the same shape from the unconditional product list so the
 * tab works before a client is picked. Once one is, the endpoint's own grouping is
 * used instead, because only it carries that client's negotiated prices.
 *
 * Breweries come out in `breweryDisplayOrder` then name; the tab re-sorts the items
 * themselves through {@link inDisplayOrder}, so only the nesting matters here.
 */
export function groupByBrewery(products: ProductListItemDto[]): BreweryGroupDto[] {
  const byBrewery = new Map<string, ProductListItemDto[]>();
  for (const p of products) {
    // Keyed by id, but products with no brewery still need a home — they would
    // otherwise vanish from a tab whose only job is showing the whole catalog.
    const key = p.breweryId ?? '';
    const bucket = byBrewery.get(key);
    if (bucket) bucket.push(p);
    else byBrewery.set(key, [p]);
  }

  const breweries = [...byBrewery.entries()].map(([breweryId, items]) => {
    const byKind = new Map<string, ProductListItemDto[]>();
    for (const p of items) {
      // The raw wire value, not a normalized name: the tab compares it through
      // kindName, which resolves either representation.
      const key = String(p.kind ?? '');
      const bucket = byKind.get(key);
      if (bucket) bucket.push(p);
      else byKind.set(key, [p]);
    }

    const kinds = [...byKind.values()].map((kindItems) => {
      const bySize = new Map<number, ProductListItemDto[]>();
      for (const p of kindItems) {
        const size = p.packageSize ?? 0;
        const bucket = bySize.get(size);
        if (bucket) bucket.push(p);
        else bySize.set(size, [p]);
      }
      return new KindGroupDto({
        kind: kindItems[0].kind,
        packageSizes: [...bySize.entries()].map(
          ([size, sizeItems]) => new PackageGroupDto({ size, items: sizeItems })
        ),
      });
    });

    return new BreweryGroupDto({
      breweryId: breweryId || undefined,
      breweryName: items[0].breweryName,
      kinds,
    });
  });

  return breweries.sort((a, b) => {
    const order = (g: BreweryGroupDto) =>
      products.find((p) => (p.breweryId ?? '') === (g.breweryId ?? ''))?.breweryDisplayOrder ?? 0;
    return order(a) - order(b) || (a.breweryName ?? '').localeCompare(b.breweryName ?? '', 'cs');
  });
}
