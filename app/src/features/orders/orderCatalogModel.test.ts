// The order editor's catalog shaping. The regression this guards: the "Dříve
// objednané" tab used to render the history endpoint's flat `recent` array as it
// came, so it read in a different order from "Procházet dle pivovaru".

import { describe, it, expect } from 'vitest';
import { ProductListItemDto, ProductKind, ProductType } from 'src/generated/api-client';
import { groupByBrewery, groupByName, inDisplayOrder } from './orderCatalogModel';

function product(fields: Partial<ProductListItemDto>): ProductListItemDto {
  return new ProductListItemDto({ id: fields.name, ...fields });
}

describe('inDisplayOrder', () => {
  it('puts beer in degree order and the soft drinks last', () => {
    const ordered = inDisplayOrder([
      product({ name: 'Limonáda', type: ProductType.Lemonade }),
      product({ name: 'Dvanáctka', type: ProductType.PaleLager, platoDegree: 12 }),
      product({ name: 'Merch', type: ProductType.Merchandise }),
      product({ name: 'Desítka', type: ProductType.PaleDraftBeer, platoDegree: 10 }),
    ]);

    expect(ordered.map((p) => p.name)).toEqual(['Desítka', 'Dvanáctka', 'Limonáda', 'Merch']);
  });

  it('does not mutate the input', () => {
    const input = [
      product({ name: 'Dvanáctka', type: ProductType.PaleLager, platoDegree: 12 }),
      product({ name: 'Desítka', type: ProductType.PaleDraftBeer, platoDegree: 10 }),
    ];

    inDisplayOrder(input);

    expect(input.map((p) => p.name)).toEqual(['Dvanáctka', 'Desítka']);
  });
});

describe('groupByName', () => {
  it('clusters same-name size variants into one group', () => {
    const groups = groupByName([
      product({ name: 'Ležák', kind: ProductKind.Keg, packageSize: 30 }),
      product({ name: 'Ležák', kind: ProductKind.Keg, packageSize: 50 }),
      product({ name: 'Desítka', kind: ProductKind.Keg, packageSize: 50 }),
    ]);

    expect(groups.map((g) => [g.name, g.items.length])).toEqual([['Ležák', 2], ['Desítka', 1]]);
  });

  it('groups in first-seen order, so a display-ordered list stays display-ordered', () => {
    const groups = groupByName(inDisplayOrder([
      product({ name: 'Limonáda', type: ProductType.Lemonade }),
      product({ name: 'Ležák', type: ProductType.PaleLager, platoDegree: 11, packageSize: 50 }),
      product({ name: 'Desítka', type: ProductType.PaleDraftBeer, platoDegree: 10, packageSize: 50 }),
      product({ name: 'Ležák', type: ProductType.PaleLager, platoDegree: 11, packageSize: 30 }),
    ]));

    expect(groups.map((g) => g.name)).toEqual(['Desítka', 'Ležák', 'Limonáda']);
    // Within the group the variants keep the size order the sort gave them.
    expect(groups[1].items.map((p) => p.packageSize)).toEqual([30, 50]);
  });

  it('keeps products with no name in a single group rather than dropping them', () => {
    const groups = groupByName([product({ id: 'a' }), product({ id: 'b' })]);

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe('groupByBrewery', () => {
  const svijany = { breweryId: 'b-svijany', breweryName: 'Svijany', breweryDisplayOrder: 1 };
  const kohout = { breweryId: 'b-kohout', breweryName: 'Kohout', breweryDisplayOrder: 2 };

  it('nests products by brewery, then kind, then package size', () => {
    const groups = groupByBrewery([
      product({ ...svijany, name: 'Máz', kind: ProductKind.Keg, packageSize: 50 }),
      product({ ...svijany, name: 'Desítka', kind: ProductKind.Keg, packageSize: 30 }),
      product({ ...svijany, name: 'Máz plech', kind: ProductKind.Can, packageSize: 0.5 }),
      product({ ...kohout, name: 'Ležák', kind: ProductKind.Keg, packageSize: 50 }),
    ]);

    expect(groups.map((g) => g.breweryName)).toEqual(['Svijany', 'Kohout']);

    const kinds = groups[0].kinds ?? [];
    expect(kinds).toHaveLength(2);
    const kegs = kinds.find((k) => k.kind === ProductKind.Keg);
    expect(kegs?.packageSizes?.map((s) => s.size)).toEqual([50, 30]);
    expect(kegs?.packageSizes?.flatMap((s) => s.items ?? [])).toHaveLength(2);
  });

  it('orders breweries by display order, then by name', () => {
    const groups = groupByBrewery([
      product({ ...kohout, name: 'Ležák' }),
      product({ ...svijany, name: 'Máz' }),
      product({ breweryId: 'b-a', breweryName: 'Áčko', breweryDisplayOrder: 1, name: 'Pivo' }),
    ]);

    // Svijany and Áčko share display order 1, so the Czech collation splits them.
    expect(groups.map((g) => g.breweryName)).toEqual(['Áčko', 'Svijany', 'Kohout']);
  });

  /** A product with no brewery would otherwise vanish from the one tab whose job is
   * showing the whole catalog. */
  it('keeps products with no brewery', () => {
    const groups = groupByBrewery([product({ name: 'Bez pivovaru', kind: ProductKind.Other })]);

    expect(groups).toHaveLength(1);
    expect(groups[0].breweryId).toBeUndefined();
    expect(groups[0].kinds?.[0].packageSizes?.[0].items?.[0].name).toBe('Bez pivovaru');
  });

  /** The real API sends enums as strings; the tab resolves either form through kindName,
   * so the raw value must pass through untouched rather than being coerced. */
  it('passes the kind through as it arrived', () => {
    const groups = groupByBrewery([
      product({ ...svijany, name: 'Máz', kind: 'Keg' as unknown as ProductKind }),
    ]);

    expect(groups[0].kinds?.[0].kind).toBe('Keg');
  });

  it('returns nothing for an empty list', () => {
    expect(groupByBrewery([])).toEqual([]);
  });
});
