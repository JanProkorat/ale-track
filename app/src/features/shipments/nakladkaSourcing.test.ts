// The over-draw warning behind the nakládka banner. The interesting part is that
// one stock entry can be drawn by several stops, so a shortage only appears once
// the draws are summed.

import { describe, expect, it } from 'vitest';
import { OutgoingShipmentOrderItemDto, OutgoingShipmentStopDto } from 'src/generated/api-client';
import { overdrawnStock } from './nakladkaSourcing';

const STOCK_A = 'stock-a';
const STOCK_B = 'stock-b';

function product(over: Partial<OutgoingShipmentOrderItemDto> = {}): OutgoingShipmentOrderItemDto {
  const dto = new OutgoingShipmentOrderItemDto({ id: 'prod-1', name: 'Albrecht 12°', quantity: 20 });
  // Sourcing fields are declared on the derived class, so they must be assigned
  // after the constructor or the subclass field initializers wipe them — the same
  // trap shipmentDraft.ts documents for productId.
  Object.assign(dto, {
    orderItemId: `item-${Math.random().toString(36).slice(2, 8)}`,
    quantityFromInventory: 0,
    ...over,
  });
  return dto;
}

function stop(products: OutgoingShipmentOrderItemDto[]): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({ id: `stop-${Math.random().toString(36).slice(2, 8)}`, products });
}

describe('overdrawnStock', () => {
  it('is empty when nothing is sourced from stock', () => {
    expect(overdrawnStock([stop([product()])])).toEqual([]);
  });

  it('is empty while the draw fits within what is on hand', () => {
    const rows = [stop([product({
      quantityFromInventory: 5, inventoryItemId: STOCK_A, inventoryItemName: 'Sud 50 l', inventoryItemAvailable: 5,
    })])];

    expect(overdrawnStock(rows)).toEqual([]);
  });

  it('reports an entry drawn beyond what is on hand', () => {
    const rows = [stop([product({
      quantityFromInventory: 8, inventoryItemId: STOCK_A, inventoryItemName: 'Sud 50 l', inventoryItemAvailable: 5,
    })])];

    expect(overdrawnStock(rows)).toEqual([{ name: 'Sud 50 l', taken: 8, available: 5 }]);
  });

  it('sums draws on one entry across stops before deciding', () => {
    // Neither stop over-draws alone; together they do. This is the case the
    // banner exists for.
    const rows = [
      stop([product({ quantityFromInventory: 4, inventoryItemId: STOCK_A, inventoryItemName: 'Sud 50 l', inventoryItemAvailable: 6 })]),
      stop([product({ quantityFromInventory: 4, inventoryItemId: STOCK_A, inventoryItemName: 'Sud 50 l', inventoryItemAvailable: 6 })]),
    ];

    expect(overdrawnStock(rows)).toEqual([{ name: 'Sud 50 l', taken: 8, available: 6 }]);
  });

  it('reports only the entries that are short', () => {
    const rows = [stop([
      product({ quantityFromInventory: 9, inventoryItemId: STOCK_A, inventoryItemName: 'Sud 50 l', inventoryItemAvailable: 2 }),
      product({ quantityFromInventory: 1, inventoryItemId: STOCK_B, inventoryItemName: 'Basa', inventoryItemAvailable: 50 }),
    ])];

    expect(overdrawnStock(rows).map((e) => e.name)).toEqual(['Sud 50 l']);
  });

  it('falls back to the product name when the stock entry is unnamed', () => {
    const rows = [stop([product({
      quantityFromInventory: 3, inventoryItemId: STOCK_A, inventoryItemName: undefined, inventoryItemAvailable: 0,
    })])];

    expect(overdrawnStock(rows)[0].name).toBe('Albrecht 12°');
  });

  it('ignores rows with a sourced quantity but no stock entry', () => {
    // Defensive: the API pairs the two, but a half-filled row must not be counted
    // as drawing from an unknown entry.
    const rows = [stop([product({ quantityFromInventory: 5, inventoryItemId: undefined, inventoryItemAvailable: 0 })])];

    expect(overdrawnStock(rows)).toEqual([]);
  });
});
