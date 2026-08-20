import { describe, it, expect } from 'vitest';
import { InventoryItemListItemDto, ProductKind } from 'src/generated/api-client';
import { groupInventoryItems, isLow, itemSubtitle } from './inventoryModel';

const item = (over: Partial<InventoryItemListItemDto>) => new InventoryItemListItemDto({
  id: 'i1',
  productId: 'p1',
  name: 'Svijanský Kníže',
  kind: ProductKind.Keg,
  packageSize: 15,
  quantity: 20,
  ...over,
});

describe('groupInventoryItems', () => {
  it('folds the sizes of one product into a single group', () => {
    const groups = groupInventoryItems([
      item({ id: 'a', productId: 'p-5', packageSize: 5 }),
      item({ id: 'b', productId: 'p-fanda', name: 'Svijanský Fanda', kind: ProductKind.Bottle, packageSize: 1 }),
      item({ id: 'c', productId: 'p-15', packageSize: 15 }),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Svijanský Kníže', 'Svijanský Fanda']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groups[1].items).toHaveLength(1);
  });

  it('places a group where its first variant appeared', () => {
    const groups = groupInventoryItems([
      item({ id: 'fanda', productId: 'p-fanda', name: 'Svijanský Fanda' }),
      item({ id: 'a', productId: 'p-5', packageSize: 5 }),
      item({ id: 'c', productId: 'p-15', packageSize: 15 }),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Svijanský Fanda', 'Svijanský Kníže']);
  });

  it('orders variants by kind then size, not by arrival', () => {
    const groups = groupInventoryItems([
      item({ id: 'can', productId: 'p-can', kind: ProductKind.Can, packageSize: 0.5 }),
      item({ id: 'keg50', productId: 'p-50', kind: ProductKind.Keg, packageSize: 50 }),
      item({ id: 'keg15', productId: 'p-15', kind: ProductKind.Keg, packageSize: 15 }),
    ]);

    expect(groups[0].items.map((i) => i.id)).toEqual(['keg15', 'keg50', 'can']);
  });

  it('keeps manual items apart even when they share a name', () => {
    // No product behind them and no size to tell them apart — merging two
    // free-text rows would claim a relationship that isn't there.
    const groups = groupInventoryItems([
      item({ id: 'm1', productId: undefined, name: 'Ucho soudku', kind: undefined, packageSize: undefined }),
      item({ id: 'm2', productId: undefined, name: 'Ucho soudku', kind: undefined, packageSize: undefined }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.items.length === 1)).toBe(true);
  });

  it('returns nothing for an empty section', () => {
    expect(groupInventoryItems([])).toEqual([]);
  });

  /**
   * Stock booked in from a supplier is already one row per good, so there is nothing to fold — and
   * folding two different goods that happen to share a name would claim they were one thing.
   */
  it('keeps each supplier good as its own group', () => {
    const groups = groupInventoryItems([
      item({ id: 'g1', productId: undefined, supplierGoodId: 'sg1', name: 'CO₂ láhev', kind: undefined, packageSize: undefined, size: '10 kg' }),
      item({ id: 'g2', productId: undefined, supplierGoodId: 'sg2', name: 'CO₂ láhev', kind: undefined, packageSize: undefined, size: '30 kg' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.items[0].size)).toEqual(['10 kg', '30 kg']);
  });
});

describe('itemSubtitle', () => {
  it('reads a product by its kind and litre volume', () => {
    expect(itemSubtitle(item({ kind: ProductKind.Keg, packageSize: 15 }))).toBe('Sud · 15 l');
  });

  /** A good's size is free text, so it must not go through the litre formatter. */
  it('reads a supplier good by the size the supplier states', () => {
    expect(itemSubtitle(item({
      productId: undefined, supplierGoodId: 'sg1', kind: undefined, packageSize: undefined, size: '10 kg',
    }))).toBe('10 kg');
  });

  it('is blank for a supplier good with no stated size', () => {
    expect(itemSubtitle(item({
      productId: undefined, supplierGoodId: 'sg1', kind: undefined, packageSize: undefined, size: undefined,
    }))).toBe('');
  });
});

describe('isLow', () => {
  it('warns on a thin product row', () => {
    expect(isLow(item({ quantity: 2 }))).toBe(true);
  });

  /**
   * The threshold is a beer number. Three CO₂ bottles is not a shortage, and a supplier's goods
   * carry no reorder level, so they stay out of the warning.
   */
  it('never warns on a supplier good', () => {
    expect(isLow(item({ productId: undefined, supplierGoodId: 'sg1', quantity: 1 }))).toBe(false);
  });
});
