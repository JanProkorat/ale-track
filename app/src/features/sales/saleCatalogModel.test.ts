import { describe, expect, it } from 'vitest';
import {
  InventoryItemListItemDto,
  InventorySectionDto,
  ProductKind,
  ProductType,
} from 'src/generated/api-client';
import {
  bySection,
  groupRowsByName,
  historyAddPrice,
  historyRows,
  searchRows,
  sellableRows,
} from './saleCatalogModel';

const item = (
  id: string,
  name: string,
  quantity: number,
  extra: Partial<InventoryItemListItemDto> = {}
) =>
  new InventoryItemListItemDto({
    id,
    name,
    quantity,
    kind: ProductKind.Keg,
    type: ProductType.PaleLager,
    packageSize: 30,
    platoDegree: 12,
    priceWithVat: 1290,
    ...extra,
  } as never);

const sections = (...s: { name: string; items: InventoryItemListItemDto[] }[]) =>
  s.map((x) => new InventorySectionDto({ id: x.name, name: x.name, items: x.items } as never));

describe('sellableRows', () => {
  it('flattens sections and tags each row with its section name', () => {
    const rows = sellableRows(
      sections(
        { name: 'Svijany', items: [item('a', 'Máz', 5)] },
        { name: 'Ostatní', items: [item('b', 'Vratné basy', 60)] }
      )
    );

    expect(rows.map((r) => [r.name, r.sectionName])).toEqual([
      ['Máz', 'Svijany'],
      ['Vratné basy', 'Ostatní'],
    ]);
  });

  it('drops rows that are out of stock — the catalog only offers what can be sold', () => {
    const rows = sellableRows(sections({ name: 'Svijany', items: [item('a', 'Máz', 0), item('b', 'Rytíř', 3)] }));
    expect(rows.map((r) => r.name)).toEqual(['Rytíř']);
  });

  it('drops rows with no id, which cannot be added to a sale', () => {
    const rows = sellableRows(sections({ name: 'Svijany', items: [item('', 'Máz', 5)] }));
    expect(rows).toHaveLength(0);
  });

  it('returns an empty list for missing data rather than throwing', () => {
    expect(sellableRows(undefined)).toEqual([]);
  });
});

describe('sellableRows client pricing', () => {
  it('offers the client price as the line default on the browse segment, marking the ceník beside it', () => {
    const rows = sellableRows(
      sections({ name: 'Svijany', items: [item('a', 'Máz', 5, { productId: 'p-maz', priceWithVat: 1290 } as never)] }),
      { 'p-maz': 1190 }
    );

    expect(rows[0].priceWithVat).toBe(1190);
    expect(rows[0].listPriceWithVat).toBe(1290);
  });

  it('leaves a walk-in on the ceník price — there is no client, so nothing to resolve', () => {
    const rows = sellableRows(
      sections({ name: 'Svijany', items: [item('a', 'Máz', 5, { productId: 'p-maz', priceWithVat: 1290 } as never)] })
    );

    expect(rows[0].priceWithVat).toBe(1290);
    expect(rows[0].listPriceWithVat).toBeUndefined();
  });

  it('leaves a product with no override of its own on the ceník price, even with other overrides in scope', () => {
    const rows = sellableRows(
      sections({ name: 'Svijany', items: [item('a', 'Máz', 5, { productId: 'p-maz', priceWithVat: 1290 } as never)] }),
      { 'p-other': 999 }
    );

    expect(rows[0].priceWithVat).toBe(1290);
    expect(rows[0].listPriceWithVat).toBeUndefined();
  });
});

describe('searchRows', () => {
  const rows = sellableRows(
    sections({ name: 'Svijany', items: [item('a', 'Svijanský Máz', 5), item('b', 'Landskron Pilsner', 3)] })
  );

  it('matches case-insensitively on the name', () => {
    expect(searchRows(rows, 'máz').map((r) => r.name)).toEqual(['Svijanský Máz']);
    expect(searchRows(rows, 'PILS').map((r) => r.name)).toEqual(['Landskron Pilsner']);
  });

  it('keeps everything for an empty or whitespace needle', () => {
    expect(searchRows(rows, '')).toHaveLength(2);
    expect(searchRows(rows, '   ')).toHaveLength(2);
  });
});

describe('groupRowsByName', () => {
  it('clusters same-name size variants into one group, in first-seen order', () => {
    const rows = sellableRows(
      sections({
        name: 'Svijany',
        items: [
          item('a', 'Svijanský Máz', 5, { packageSize: 30 }),
          item('b', 'Svijanský Rytíř', 4),
          item('c', 'Svijanský Máz', 2, { packageSize: 50 }),
        ],
      })
    );

    const groups = groupRowsByName(rows);
    expect(groups.map((g) => g.name)).toEqual(['Svijanský Máz', 'Svijanský Rytíř']);
    expect(groups[0].items.map((i) => i.packageSize)).toEqual([30, 50]);
  });
});

describe('bySection', () => {
  it('preserves the endpoint section order and groups within each', () => {
    const rows = sellableRows(
      sections(
        { name: 'Svijany', items: [item('a', 'Máz', 5), item('b', 'Máz', 2, { packageSize: 50 })] },
        { name: 'Ostatní', items: [item('c', 'Vratné basy', 60)] }
      )
    );

    const result = bySection(rows);
    expect(result.map((s) => s.name)).toEqual(['Svijany', 'Ostatní']);
    expect(result[0].groups).toHaveLength(1);
    expect(result[0].groups[0].items).toHaveLength(2);
  });
});

describe('historyRows', () => {
  const stock = sellableRows(
    sections({
      name: 'Svijany',
      items: [
        item('in-maz', 'Svijanský Máz', 9, { platoDegree: 11 }),
        item('in-rytir', 'Svijanský Rytíř', 4, { platoDegree: 12 }),
      ],
    })
  );

  it('joins remembered purchases onto the live stock rows', () => {
    const rows = historyRows(
      [{ inventoryItemId: 'in-maz', lastSoldDate: '2026-08-02', lastUnitPriceWithVat: 1750, lastQuantity: 5 }],
      stock
    );

    const row = rows[0];
    expect(row.name).toBe('Svijanský Máz');
    expect(row.quantity).toBe(9);
    expect(row.lastUnitPriceWithVat).toBe(1750);
    expect(row.lastQuantity).toBe(5);
  });

  it('omits a remembered item that is no longer in stock', () => {
    const rows = historyRows([{ inventoryItemId: 'in-gone', lastUnitPriceWithVat: 100 }], stock);
    expect(rows).toEqual([]);
  });

  it('re-sorts into display order so both tabs agree on where an item sits', () => {
    // Endpoint order is newest-first: Rytíř (12°) before Máz (11°). Display order is by degree.
    const rows = historyRows(
      [
        { inventoryItemId: 'in-rytir', lastSoldDate: '2026-08-10' },
        { inventoryItemId: 'in-maz', lastSoldDate: '2026-08-02' },
      ],
      stock
    );

    expect(rows.map((r) => r.name)).toEqual(['Svijanský Máz', 'Svijanský Rytíř']);
  });

  it('returns an empty list when the client has no history', () => {
    expect(historyRows(undefined, stock)).toEqual([]);
    expect(historyRows([], stock)).toEqual([]);
  });
});

describe('historyAddPrice', () => {
  // Three distinguishable numbers so no assertion here can pass by coincidence: ceník 1290,
  // override 1190, last-paid 999.
  const stockWithOverride = sellableRows(
    sections({
      name: 'Svijany',
      items: [item('in-maz', 'Svijanský Máz', 9, { productId: 'p-maz', priceWithVat: 1290 } as never)],
    }),
    { 'p-maz': 1190 }
  );
  const stockWithoutOverride = sellableRows(
    sections({
      name: 'Svijany',
      items: [item('in-maz', 'Svijanský Máz', 9, { productId: 'p-maz', priceWithVat: 1290 } as never)],
    })
  );

  it('lets the client price win over what the client last paid, while the row keeps the last-paid figure', () => {
    const rows = historyRows(
      [{ inventoryItemId: 'in-maz', lastUnitPriceWithVat: 999, lastQuantity: 3 }],
      stockWithOverride
    );
    const row = rows[0];

    // A decision (the override) outranks an observation (the last price paid).
    expect(historyAddPrice(row)).toBe(1190);
    // The segment's whole point: it keeps showing what was actually paid, even though the
    // suggested add price above is the override.
    expect(row.lastUnitPriceWithVat).toBe(999);
  });

  it('falls back to the last-paid price when there is no override', () => {
    const rows = historyRows(
      [{ inventoryItemId: 'in-maz', lastUnitPriceWithVat: 999, lastQuantity: 3 }],
      stockWithoutOverride
    );

    expect(historyAddPrice(rows[0])).toBe(999);
  });

  it('suggests nothing when neither an override nor a last price exists, leaving the ceník to apply', () => {
    const rows = historyRows([{ inventoryItemId: 'in-maz' }], stockWithoutOverride);

    expect(historyAddPrice(rows[0])).toBeUndefined();
  });
});
