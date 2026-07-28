import { describe, it, expect } from 'vitest';
import { InventoryItemListItemDto, ProductKind } from 'src/generated/api-client';
import { groupInventoryItems } from './inventoryModel';

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
});
