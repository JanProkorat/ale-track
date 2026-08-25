// What the recording drawer's picker offers, and in what order. The grouping only holds if the
// options arrive sorted — MUI repeats a heading whose options are not adjacent — so the order is
// the behaviour here, not a cosmetic detail.

import { describe, expect, it } from 'vitest';
import { ProductKind, ProductListItemDto } from 'src/generated/api-client';
import { productPickerOptions } from './productPickerOptions';

function product(over: Partial<ProductListItemDto> = {}): ProductListItemDto {
  return ProductListItemDto.fromJS({
    id: `p-${Math.random()}`,
    name: 'Ležák 12',
    kind: ProductKind.Keg,
    breweryName: 'Svijany',
    breweryDisplayOrder: 1,
    displayOrder: 1,
    packageSize: 50,
    ...over,
  });
}

const NONE = new Set<string | undefined>();

describe('productPickerOptions', () => {
  it('heads each option with its brewery and kind', () => {
    const [option] = productPickerOptions([product()], NONE);

    expect(option.group).toBe('Svijany · Sud');
    expect(option.label).toBe('Ležák 12');
  });

  it('puts the package size on the second line, not in the name', () => {
    const [option] = productPickerOptions([product({ packageSize: 0.5, kind: ProductKind.Bottle })], NONE);

    expect(option.label).toBe('Ležák 12');
    expect(option.secondary).toBe('0,5 l');
  });

  // Brewery first, then kind: any other order splits a heading into two.
  it('keeps every brewery-and-kind heading contiguous', () => {
    const options = productPickerOptions([
      product({ id: 'a', breweryName: 'Svijany', breweryDisplayOrder: 1, kind: ProductKind.Keg }),
      product({ id: 'b', breweryName: 'Primátor', breweryDisplayOrder: 2, kind: ProductKind.Can }),
      product({ id: 'c', breweryName: 'Svijany', breweryDisplayOrder: 1, kind: ProductKind.Can }),
      product({ id: 'd', breweryName: 'Primátor', breweryDisplayOrder: 2, kind: ProductKind.Keg }),
      product({ id: 'e', breweryName: 'Svijany', breweryDisplayOrder: 1, kind: ProductKind.Keg }),
    ], NONE);

    const groups = options.map((o) => o.group);
    expect(new Set(groups).size).toBe(groups.filter((g, i) => g !== groups[i - 1]).length);
  });

  it('ranks breweries the way the catalog does, not alphabetically', () => {
    const options = productPickerOptions([
      product({ id: 'a', breweryName: 'Áčko', breweryDisplayOrder: 9 }),
      product({ id: 'b', breweryName: 'Žižkov', breweryDisplayOrder: 1 }),
    ], NONE);

    expect(options.map((o) => o.group)).toEqual(['Žižkov · Sud', 'Áčko · Sud']);
  });

  it('orders one brewery-and-kind block by the product, then by size', () => {
    const options = productPickerOptions([
      product({ id: 'a', name: 'Ležák 12', displayOrder: 1, packageSize: 50 }),
      product({ id: 'b', name: 'Ležák 12', displayOrder: 1, packageSize: 30 }),
      product({ id: 'c', name: 'Desítka', displayOrder: 2, packageSize: 15 }),
    ], NONE);

    expect(options.map((o) => o.value)).toEqual(['b', 'a', 'c']);
  });

  it('leaves out what already has a row on the form', () => {
    const options = productPickerOptions(
      [product({ id: 'keep' }), product({ id: 'drop' })],
      new Set(['drop']),
    );

    expect(options.map((o) => o.value)).toEqual(['keep']);
  });

  // A product with no brewery still needs a heading to sit under, or it disappears into the
  // previous brewery's block.
  it('files a brewery-less product under Ostatní', () => {
    const [option] = productPickerOptions([product({ breweryName: undefined })], NONE);

    expect(option.group).toBe('Ostatní · Sud');
  });

  it('is empty rather than throwing before the catalog has loaded', () => {
    expect(productPickerOptions(undefined, NONE)).toEqual([]);
  });

  it('skips a product with no id, which nothing could pick', () => {
    expect(productPickerOptions([product({ id: undefined })], NONE)).toEqual([]);
  });

  it('does not reorder the caller\'s array', () => {
    const products = [
      product({ id: 'a', breweryDisplayOrder: 2 }),
      product({ id: 'b', breweryDisplayOrder: 1 }),
    ];
    productPickerOptions(products, NONE);

    expect(products.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
