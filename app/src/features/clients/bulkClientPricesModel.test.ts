// Pure arithmetic and row-shaping for the bulk catalog price editor — the
// risky part of Task 10's "Hromadná úprava cen" drawer. Kept out of the
// component so idempotence, the ceník-vs-client-price distinction, and the
// replace-payload shaping are provable without a rendering harness.

import { describe, expect, it } from 'vitest';
import {
  countReplaceEntries, fillFromPercent, rowState, toReplacePayload,
} from './bulkClientPricesModel';

describe('fillFromPercent', () => {
  it('fills every product from its ceník price, not from the client price', () => {
    const products = [
      { id: 'a', priceWithVat: 1290 },
      { id: 'b', priceWithVat: 480 },
    ];
    expect(fillFromPercent(products, -5)).toEqual({ a: '1226', b: '456' });
  });

  it('is idempotent — running it twice gives the same numbers', () => {
    const products = [{ id: 'a', priceWithVat: 1290 }];
    const once = fillFromPercent(products, -5);
    const twice = fillFromPercent(products, -5);
    expect(twice).toEqual(once);
  });

  it('treats a positive percentage as an increase', () => {
    expect(fillFromPercent([{ id: 'a', priceWithVat: 1000 }], 3)).toEqual({ a: '1030' });
  });
});

describe('rowState', () => {
  it('marks a row the client has no price for as new', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1226', undefined).isNew).toBe(true);
  });

  it('marks a row priced above what the client pays today', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1226', 1190).raisesPrice).toBe(true);
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1100', 1190).raisesPrice).toBe(false);
  });

  it('marks a cleared row as reverting to the ceník', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '', 1190).revertsToList).toBe(true);
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '', undefined).revertsToList).toBe(false);
  });

  it('does not mark an existing price as new, nor an unchanged price as a raise', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1190', 1190).isNew).toBe(false);
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1190', 1190).raisesPrice).toBe(false);
  });

  it('treats an unparseable draft as no draft at all', () => {
    const marks = rowState({ id: 'a', priceWithVat: 1290 }, 'abc', 1190);
    expect(marks).toEqual({ isNew: false, raisesPrice: false, revertsToList: false });
  });
});

describe('toReplacePayload', () => {
  it('drops empty and non-positive entries', () => {
    expect(toReplacePayload({ a: '1226', b: '', c: '0', d: '-5' }))
      .toEqual([{ productId: 'a', priceWithVat: 1226 }]);
  });

  it('drops an unparseable entry rather than writing NaN', () => {
    expect(toReplacePayload({ a: 'abc' })).toEqual([]);
  });

  it('keeps every valid entry regardless of insertion order', () => {
    expect(toReplacePayload({ a: '100', b: '200' })).toEqual([
      { productId: 'a', priceWithVat: 100 },
      { productId: 'b', priceWithVat: 200 },
    ]);
  });
});

describe('countReplaceEntries', () => {
  it('agrees with toReplacePayload\'s length for the same draft', () => {
    const draft = { a: '1226', b: '', c: '0', d: '-5', e: 'abc', f: '300' };
    expect(countReplaceEntries(draft)).toBe(toReplacePayload(draft).length);
  });

  it('counts zero for an empty or all-invalid draft', () => {
    expect(countReplaceEntries({})).toBe(0);
    expect(countReplaceEntries({ a: '', b: '0', c: 'abc' })).toBe(0);
  });
});
