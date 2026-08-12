import { describe, it, expect } from 'vitest';
import { ProductKind, ProductType } from 'src/generated/api-client';
import { compareKindThenSize, compareProductsForDisplay, isNonBeer } from './productSort';

/** Mirrors the backend's ProductOrderingTests — the two must not drift. */
describe('compareProductsForDisplay', () => {
  const sorted = (items: Parameters<typeof compareProductsForDisplay>[0][]) =>
    items.slice().sort(compareProductsForDisplay).map((i) => i.name);

  it('sorts by degree ascending', () => {
    expect(sorted([
      { name: 'Dvanáctka', type: ProductType.PaleLager, platoDegree: 12 },
      { name: 'Desítka', type: ProductType.PaleDraftBeer, platoDegree: 10 },
      { name: 'Jedenáctka', type: ProductType.PaleLager, platoDegree: 11 },
    ])).toEqual(['Desítka', 'Jedenáctka', 'Dvanáctka']);
  });

  it('drops limonáda, merch and ostatní to the end', () => {
    expect(sorted([
      { name: 'Limonáda', type: ProductType.Lemonade },
      { name: 'Merch', type: ProductType.Merchandise },
      { name: 'Desítka', type: ProductType.PaleDraftBeer, platoDegree: 10 },
      { name: 'Ostatní', type: ProductType.Other },
    ])).toEqual(['Desítka', 'Limonáda', 'Merch', 'Ostatní']);
  });

  it('keeps degreeless beer ahead of the soft drinks', () => {
    // Nealko and radler are beer without a degree: after the degreed beers,
    // in front of the limonáda.
    expect(sorted([
      { name: 'Limonáda', type: ProductType.Lemonade },
      { name: 'Nealko', type: ProductType.NonAlcoholicBeer },
      { name: 'Radler', type: ProductType.Radler },
      { name: 'Dvanáctka', type: ProductType.PaleLager, platoDegree: 12 },
    ])).toEqual(['Dvanáctka', 'Nealko', 'Radler', 'Limonáda']);
  });

  // Real products carry `type` as the enum's string name, because the backend serializes enums
  // as strings. While isNonBeer compared that to the numeric member it was always false, so
  // limonáda and merch sorted among the beers on every screen that regroups rows itself — the
  // nakládka table, the order catalogue, inventory, the product combos.
  it('sorts non-beer last when the type arrives as a string', () => {
    expect(sorted([
      { name: 'Limonáda', type: 'Lemonade' as unknown as ProductType },
      { name: 'Merch', type: 'Merchandise' as unknown as ProductType },
      { name: 'Dvanáctka', type: 'PaleLager' as unknown as ProductType, platoDegree: 12 },
    ])).toEqual(['Dvanáctka', 'Limonáda', 'Merch']);
  });

  it('breaks a degree tie by package size', () => {
    expect(sorted([
      { name: 'Sud 50', type: ProductType.PaleLager, platoDegree: 11, packageSize: 50 },
      { name: 'Plechovka', type: ProductType.PaleLager, platoDegree: 11, packageSize: 0.5 },
      { name: 'Sud 15', type: ProductType.PaleLager, platoDegree: 11, packageSize: 15 },
    ])).toEqual(['Plechovka', 'Sud 15', 'Sud 50']);
  });

  it('breaks a size tie by name, Czech collation', () => {
    expect(sorted([
      { name: 'Řezák', type: ProductType.PaleLager, platoDegree: 11, packageSize: 50 },
      { name: 'Rytíř', type: ProductType.PaleLager, platoDegree: 11, packageSize: 50 },
    ])).toEqual(['Rytíř', 'Řezák']);
  });

  it('treats an unknown type as beer rather than burying it', () => {
    expect(sorted([
      { name: 'Limonáda', type: ProductType.Lemonade },
      { name: 'Bez typu', platoDegree: 11 },
    ])).toEqual(['Bez typu', 'Limonáda']);
  });
});

describe('isNonBeer', () => {
  it.each([
    [ProductType.Lemonade, true],
    [ProductType.Merchandise, true],
    [ProductType.Other, true],
    [ProductType.NonAlcoholicBeer, false],
    [ProductType.Radler, false],
    [ProductType.PaleLager, false],
    [undefined, false],
  ])('classifies %s', (type, expected) => {
    expect(isNonBeer(type)).toBe(expected);
  });

  // The regression this guards: real products carry `type` as the enum's *string* name, because
  // the backend serializes enums as strings. Comparing that to the numeric member was always
  // false, so limonáda, merch and ostatní sorted among the beers on every screen that regroups
  // rows itself — the nakládka table, the order catalogue, inventory, the product combos.
  it.each([
    ['Lemonade', true],
    ['Merchandise', true],
    ['Other', true],
    ['NonAlcoholicBeer', false],
    ['PaleLager', false],
  ])('classifies %s when it arrives as a string', (type, expected) => {
    expect(isNonBeer(type)).toBe(expected);
  });

});

describe('compareKindThenSize', () => {
  it('still orders variants of one product by kind then size', () => {
    const order = [
      { kind: ProductKind.Can, packageSize: 0.5 },
      { kind: ProductKind.Keg, packageSize: 50 },
      { kind: ProductKind.Keg, packageSize: 15 },
    ].slice().sort(compareKindThenSize);

    expect(order).toEqual([
      { kind: ProductKind.Keg, packageSize: 15 },
      { kind: ProductKind.Keg, packageSize: 50 },
      { kind: ProductKind.Can, packageSize: 0.5 },
    ]);
  });
});
