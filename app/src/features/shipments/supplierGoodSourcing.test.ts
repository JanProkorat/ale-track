// Aggregating a run's supplier-good lines into one row per good, and picking which underlying
// line a stepper click writes to.

import { describe, expect, it } from 'vitest';
import { OutgoingShipmentSupplierGoodDto } from 'src/generated/api-client';
import {
  aggregateSupplierGoods, nextSourcingWrite, overdrawnSupplierGoods,
} from './supplierGoodSourcing';

function line(over: Partial<OutgoingShipmentSupplierGoodDto> = {}): OutgoingShipmentSupplierGoodDto {
  return new OutgoingShipmentSupplierGoodDto({
    id: 'line-1',
    supplierGoodId: 'g-co2',
    name: 'CO₂ láhev',
    size: '10 kg',
    quantity: 2,
    quantityFromGarage: 0,
    ...over,
  });
}

describe('aggregateSupplierGoods', () => {
  it('sums quantity and the garage split across every order asking for a good', () => {
    const rows = aggregateSupplierGoods([
      line({ id: 'l-1', quantity: 2, quantityFromGarage: 1 }),
      line({ id: 'l-2', quantity: 3, quantityFromGarage: 3 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(5);
    expect(rows[0].fromGarage).toBe(4);
    // Both lines ride along, because that is what a click has to choose between.
    expect(rows[0].sources.map((s) => s.id)).toEqual(['l-1', 'l-2']);
  });

  // Two suppliers can both sell a "CO₂ láhev"; one row covering both would misreport where
  // either is collected from.
  it('keys on the good, not its name', () => {
    const rows = aggregateSupplierGoods([
      line({ id: 'l-1', supplierGoodId: 'g-a' }),
      line({ id: 'l-2', supplierGoodId: 'g-b' }),
    ]);

    expect(rows).toHaveLength(2);
  });

  it('keeps the order the server sent', () => {
    const rows = aggregateSupplierGoods([
      line({ id: 'l-1', supplierGoodId: 'g-b', name: 'Přepravka' }),
      line({ id: 'l-2', supplierGoodId: 'g-a', name: 'CO₂ láhev' }),
    ]);

    expect(rows.map((r) => r.name)).toEqual(['Přepravka', 'CO₂ láhev']);
  });

  it('takes the on-hand figure from the first line, since every line reports the same one', () => {
    const rows = aggregateSupplierGoods([
      line({ id: 'l-1', garageAvailable: 7 }),
      line({ id: 'l-2', garageAvailable: 7 }),
    ]);

    expect(rows[0].garageAvailable).toBe(7);
  });

  it('returns nothing for no lines', () => {
    expect(aggregateSupplierGoods([])).toEqual([]);
  });
});

describe('nextSourcingWrite', () => {
  it('fills the first line that still has supplier pieces', () => {
    const [row] = aggregateSupplierGoods([
      line({ id: 'l-1', quantity: 2, quantityFromGarage: 2 }),
      line({ id: 'l-2', quantity: 3, quantityFromGarage: 1 }),
    ]);

    // l-1 is already fully from the garage, so the piece lands on l-2.
    expect(nextSourcingWrite(row, 1)).toEqual({ itemId: 'l-2', quantityFromGarage: 2 });
  });

  it('takes a piece off the last line that has garage pieces', () => {
    const [row] = aggregateSupplierGoods([
      line({ id: 'l-1', quantity: 2, quantityFromGarage: 2 }),
      line({ id: 'l-2', quantity: 3, quantityFromGarage: 1 }),
    ]);

    expect(nextSourcingWrite(row, -1)).toEqual({ itemId: 'l-2', quantityFromGarage: 0 });
  });

  it('is null when every piece is already from the garage', () => {
    const [row] = aggregateSupplierGoods([line({ quantity: 2, quantityFromGarage: 2 })]);

    expect(nextSourcingWrite(row, 1)).toBeNull();
  });

  it('is null when nothing is from the garage yet', () => {
    const [row] = aggregateSupplierGoods([line({ quantity: 2, quantityFromGarage: 0 })]);

    expect(nextSourcingWrite(row, -1)).toBeNull();
  });

  // Repeated clicks must walk the lines rather than bounce between two of them, so the sequence
  // of writes is predictable — this is the whole reason the direction rules differ.
  it('walks line by line as the clicks repeat', () => {
    const rows = () => aggregateSupplierGoods([
      line({ id: 'l-1', quantity: 1, quantityFromGarage: 0 }),
      line({ id: 'l-2', quantity: 1, quantityFromGarage: 0 }),
    ]);

    const first = nextSourcingWrite(rows()[0], 1);
    expect(first).toEqual({ itemId: 'l-1', quantityFromGarage: 1 });

    // After the server stored that, the next click moves on to l-2.
    const afterFirst = aggregateSupplierGoods([
      line({ id: 'l-1', quantity: 1, quantityFromGarage: 1 }),
      line({ id: 'l-2', quantity: 1, quantityFromGarage: 0 }),
    ]);
    expect(nextSourcingWrite(afterFirst[0], 1)).toEqual({ itemId: 'l-2', quantityFromGarage: 1 });
  });

  it('never writes past the line\'s own quantity', () => {
    const [row] = aggregateSupplierGoods([line({ id: 'l-1', quantity: 3, quantityFromGarage: 2 })]);

    expect(nextSourcingWrite(row, 5)).toEqual({ itemId: 'l-1', quantityFromGarage: 3 });
  });
});

describe('overdrawnSupplierGoods', () => {
  it('reports a good drawn beyond what the garage holds', () => {
    const rows = aggregateSupplierGoods([line({ quantity: 5, quantityFromGarage: 4, garageAvailable: 2 })]);

    expect(overdrawnSupplierGoods(rows)).toHaveLength(1);
  });

  it('is quiet when the garage covers the draw', () => {
    const rows = aggregateSupplierGoods([line({ quantity: 5, quantityFromGarage: 2, garageAvailable: 2 })]);

    expect(overdrawnSupplierGoods(rows)).toEqual([]);
  });

  // No figure to be over: the warehouse has never booked one of these in.
  it('is quiet about a good the warehouse does not track', () => {
    const rows = aggregateSupplierGoods([line({ quantity: 5, quantityFromGarage: 5, garageAvailable: undefined })]);

    expect(overdrawnSupplierGoods(rows)).toEqual([]);
  });
});
