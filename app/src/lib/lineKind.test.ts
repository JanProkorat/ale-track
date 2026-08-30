// What an order line is for, read from either wire representation.
//
// The backend serializes enums as strings in real mode and the generated enums are numeric, so
// every one of these helpers has to survive both — the mistake `enumName` exists to prevent.

import { describe, expect, it } from 'vitest';
import { OrderLineKind } from 'src/generated/api-client';
import { lineKindLabel, lineKindName, lineTravels } from './labels';

describe('lineKindName', () => {
  it('reads the numeric enum', () => {
    expect(lineKindName(OrderLineKind.BillOnly)).toBe('BillOnly');
  });

  it('reads the wire string', () => {
    expect(lineKindName('Private')).toBe('Private');
  });

  // An older order, or a line the client never sent a kind for.
  it('falls back to an ordinary line', () => {
    expect(lineKindName(undefined)).toBe('Normal');
  });
});

describe('lineKindLabel', () => {
  it('names the two unusual kinds', () => {
    expect(lineKindLabel(OrderLineKind.BillOnly)).toBe('Jen fakturace');
    expect(lineKindLabel(OrderLineKind.Private)).toBe('Soukromě');
  });

  // No chip on the ordinary case: a label on every row labels nothing.
  it('leaves an ordinary line unlabelled', () => {
    expect(lineKindLabel(OrderLineKind.Normal)).toBeUndefined();
    expect(lineKindLabel(undefined)).toBeUndefined();
  });
});

describe('lineTravels', () => {
  // The one question the nakládka and the vykládka ask.
  it('is false only for a bill-only line', () => {
    expect(lineTravels(OrderLineKind.BillOnly)).toBe(false);
    expect(lineTravels('BillOnly')).toBe(false);
    expect(lineTravels(OrderLineKind.Private)).toBe(true);
    expect(lineTravels(OrderLineKind.Normal)).toBe(true);
    expect(lineTravels(undefined)).toBe(true);
  });
});
