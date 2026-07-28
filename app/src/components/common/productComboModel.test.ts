import { describe, it, expect } from 'vitest';
import { ProductKind, ProductListItemDto } from 'src/generated/api-client';
import {
  buildRows,
  breweryKey,
  nameKey,
  productComboLabel,
  matchesProductSearch,
  NO_BREWERY,
  type ComboRow,
} from './productComboModel';

function product(over: Partial<ProductListItemDto>): ProductListItemDto {
  return new ProductListItemDto({
    id: 'p1',
    name: 'Pivo',
    kind: ProductKind.Keg,
    packageSize: 30,
    breweryId: 'b1',
    breweryName: 'Svijany',
    ...over,
  });
}

/** Svijany: Pomeranč in two sizes + a single-size Malina. Primátor: one product. */
const catalog = [
  product({ id: 'sv-30', name: 'Svijanela Pomeranč', packageSize: 30 }),
  product({ id: 'sv-50', name: 'Svijanela Pomeranč', packageSize: 50 }),
  product({ id: 'sv-ma', name: 'Svijanela Malina', packageSize: 30 }),
  product({ id: 'pr-50', name: 'Rytířský 12', packageSize: 50, breweryId: 'b2', breweryName: 'Primátor' }),
];

const none = new Set<string>();
const shape = (rows: ComboRow[]) =>
  rows.map((r) => (r.type === 'product' ? `${r.type}:${r.key}` : `${r.type}:${r.key}`));

describe('buildRows', () => {
  it('nests size variants under a name head and leaves single variants standalone', () => {
    const rows = buildRows(catalog, { collapsed: none, search: '' });

    expect(rows.map((r) => r.type)).toEqual([
      'brewery', 'name', 'product', 'product', 'product',
      'brewery', 'product',
    ]);
    const pomeranc = rows[1];
    expect(pomeranc.type === 'name' && pomeranc.count).toBe(2);
    const malina = rows[4];
    expect(malina.type === 'product' && malina.standalone).toBe(true);
    const firstVariant = rows[2];
    expect(firstVariant.type === 'product' && firstVariant.standalone).toBe(false);
  });

  it('counts a brewery by its products, not its name groups', () => {
    const rows = buildRows(catalog, { collapsed: none, search: '' });
    const svijany = rows[0];
    expect(svijany.type === 'brewery' && svijany.count).toBe(3);
  });

  it('keeps first-seen group order', () => {
    const rows = buildRows(catalog, { collapsed: none, search: '' });
    const breweries = rows.filter((r) => r.type === 'brewery').map((r) => r.breweryName);
    expect(breweries).toEqual(['Svijany', 'Primátor']);
  });

  it('drops the children of a collapsed brewery but keeps its head', () => {
    const rows = buildRows(catalog, { collapsed: new Set([breweryKey(catalog[0])]), search: '' });

    expect(shape(rows)).toEqual(['brewery:b:b1', 'brewery:b:b2', 'product:pr-50']);
    expect(rows[0].type === 'brewery' && rows[0].collapsed).toBe(true);
    expect(rows[0].type === 'brewery' && rows[0].count).toBe(3);
  });

  it('drops the variants of a collapsed name group but keeps its siblings', () => {
    const rows = buildRows(catalog, { collapsed: new Set([nameKey(catalog[0])]), search: '' });

    expect(shape(rows)).toEqual([
      'brewery:b:b1', 'name:b:b1|n:Svijanela Pomeranč', 'product:sv-ma',
      'brewery:b:b2', 'product:pr-50',
    ]);
  });

  it('ignores collapse state while searching, so a hit is never hidden', () => {
    const collapsed = new Set([breweryKey(catalog[0]), nameKey(catalog[0])]);
    const rows = buildRows(catalog, { collapsed, search: 'pomeranč' });

    expect(shape(rows)).toEqual([
      'brewery:b:b1', 'name:b:b1|n:Svijanela Pomeranč', 'product:sv-30', 'product:sv-50',
    ]);
  });

  it('prunes breweries with no match instead of leaving an empty head', () => {
    const rows = buildRows(catalog, { collapsed: none, search: 'rytíř' });
    expect(shape(rows)).toEqual(['brewery:b:b2', 'product:pr-50']);
  });

  it('matches on brewery name too', () => {
    const rows = buildRows(catalog, { collapsed: none, search: 'primátor' });
    expect(rows.filter((r) => r.type === 'product')).toHaveLength(1);
  });

  it('re-flattens a name group that a search narrows to one variant', () => {
    const rows = buildRows(catalog, { collapsed: none, search: 'svijanela pomeranč' });
    // Both variants still match the name, so the head stays.
    expect(rows.filter((r) => r.type === 'name')).toHaveLength(1);
  });

  it('orders variants by kind, then by size ascending', () => {
    // The order they arrive in is neither: can, then kegs largest-first, then a crate.
    const desitka = [
      product({ id: 'can', name: 'Svijanská Desítka', kind: ProductKind.Can, packageSize: 0.5 }),
      product({ id: 'keg50', name: 'Svijanská Desítka', kind: ProductKind.Keg, packageSize: 50 }),
      product({ id: 'keg30', name: 'Svijanská Desítka', kind: ProductKind.Keg, packageSize: 30 }),
      product({ id: 'keg15', name: 'Svijanská Desítka', kind: ProductKind.Keg, packageSize: 15 }),
      product({ id: 'crate', name: 'Svijanská Desítka', kind: ProductKind.Bottle, packageSize: 0.5 }),
    ];
    const rows = buildRows(desitka, { collapsed: none, search: '' });

    expect(rows.filter((r) => r.type === 'product').map((r) => r.key))
      .toEqual(['keg15', 'keg30', 'keg50', 'crate', 'can']);
  });

  it('sorts a variant with no size last within its kind', () => {
    const mixed = [
      product({ id: 'nosize', name: 'Pivo', kind: ProductKind.Keg, packageSize: undefined }),
      product({ id: 'keg30', name: 'Pivo', kind: ProductKind.Keg, packageSize: 30 }),
    ];
    const rows = buildRows(mixed, { collapsed: none, search: '' });

    expect(rows.filter((r) => r.type === 'product').map((r) => r.key)).toEqual(['keg30', 'nosize']);
  });

  describe('motion', () => {
    const bKey = breweryKey(catalog[0]);
    const nKey = nameKey(catalog[0]);

    it('keeps the children of a collapsed group that is animating out', () => {
      const rows = buildRows(catalog, {
        collapsed: new Set([bKey]),
        search: '',
        motion: new Map([[bKey, 'out' as const]]),
      });

      expect(shape(rows)).toEqual([
        'brewery:b:b1', 'name:b:b1|n:Svijanela Pomeranč', 'product:sv-30', 'product:sv-50', 'product:sv-ma',
        'brewery:b:b2', 'product:pr-50',
      ]);
      // Everything under the collapsing brewery moves with it; the untouched
      // brewery's rows stay still.
      expect(rows.slice(1, 5).every((r) => r.type !== 'brewery' && r.motion === 'out')).toBe(true);
      expect(rows[6].type === 'product' && rows[6].motion).toBeUndefined();
    });

    it('marks the children of a freshly expanded group as entering', () => {
      const rows = buildRows(catalog, {
        collapsed: new Set(),
        search: '',
        motion: new Map([[nKey, 'in' as const]]),
      });

      const variants = rows.filter((r) => r.type === 'product' && !r.standalone);
      expect(variants).toHaveLength(2);
      expect(variants.every((r) => r.type === 'product' && r.motion === 'in')).toBe(true);
      // The name head itself isn't moving — only what it reveals.
      expect(rows[1].type === 'name' && rows[1].motion).toBeUndefined();
    });

    it('ignores a motion that contradicts the collapse state', () => {
      // An 'in' left over on a group that is now collapsed must not resurrect
      // its rows, and an 'out' on an expanded group must not mark them inert.
      const stale = buildRows(catalog, {
        collapsed: new Set([bKey]),
        search: '',
        motion: new Map([[bKey, 'in' as const]]),
      });
      expect(shape(stale)).toEqual(['brewery:b:b1', 'brewery:b:b2', 'product:pr-50']);

      const expanded = buildRows(catalog, {
        collapsed: new Set(),
        search: '',
        motion: new Map([[bKey, 'out' as const]]),
      });
      expect(expanded.every((r) => r.type === 'brewery' || r.motion === undefined)).toBe(true);
    });

    it('drops motion while searching, like it drops collapse', () => {
      const rows = buildRows(catalog, {
        collapsed: new Set([bKey]),
        search: 'pomeranč',
        motion: new Map([[bKey, 'out' as const]]),
      });

      expect(rows.every((r) => r.type === 'brewery' || r.motion === undefined)).toBe(true);
    });
  });

  it('returns nothing for a search that matches nothing', () => {
    expect(buildRows(catalog, { collapsed: none, search: 'xyz' })).toEqual([]);
  });

  it('handles products with no brewery', () => {
    const rows = buildRows([product({ id: 'x', breweryId: undefined, breweryName: undefined })], {
      collapsed: none,
      search: '',
    });
    expect(rows[0].type === 'brewery' && rows[0].breweryName).toBe(NO_BREWERY);
  });
});

describe('productComboLabel', () => {
  it('reads name, size and brewery', () => {
    expect(productComboLabel(catalog[0])).toBe('Svijanela Pomeranč (30 l) — Svijany');
  });

  it('omits a missing size', () => {
    expect(productComboLabel(product({ name: 'Merch', packageSize: undefined }))).toBe('Merch — Svijany');
  });
});

describe('matchesProductSearch', () => {
  it('is case-insensitive and ignores surrounding space', () => {
    expect(matchesProductSearch(catalog[0], '  POMERANČ ')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesProductSearch(catalog[0], '   ')).toBe(true);
  });
});
