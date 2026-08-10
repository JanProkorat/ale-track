import { describe, expect, it } from 'vitest';
import { OutgoingShipmentStopDto, OutgoingShipmentStopKind } from 'src/generated/api-client';
import { unloadOrder } from './unloadOrder';

const orderStop = (order: number, clientName: string, products: unknown[] = []) =>
  new OutgoingShipmentStopDto({
    id: `stop-${order}`, order, kind: OutgoingShipmentStopKind.Order, clientName, products,
  } as never);

describe('unloadOrder', () => {
  it('lists stops in route order regardless of the order they arrive in', () => {
    const result = unloadOrder([orderStop(2, 'Bílý Kostel'), orderStop(1, 'Chrastava')], []);

    expect(result.map((s) => s.seq)).toEqual([1, 2]);
    expect(result.map((s) => s.title)).toEqual(['Chrastava', 'Bílý Kostel']);
  });

  it('puts the stock purchases on the company stop, gated by kind rather than position', () => {
    // The company stop sorts FIRST here (order: 1), with an order stop after it
    // (order: 2) — a regression that hands stockPurchases to "whichever stop sorts
    // last" instead of gating on kind would put them on the order stop instead, and
    // this would catch it.
    //
    // `kind` arrives as the wire STRING on real API responses ('Company'), never the
    // numeric enum member — this is the fixture a raw
    // `stop.kind === OutgoingShipmentStopKind.Company` comparison gets wrong while a
    // numeric-only fixture would let it slide.
    const company = new OutgoingShipmentStopDto({
      id: 'hq', order: 1, kind: 'Company' as unknown as OutgoingShipmentStopKind, label: 'AleTrack s.r.o.',
    } as never);
    const purchases = [{ name: 'Svijanský Rytíř', quantity: 48, packageSize: 0.5 }];

    const result = unloadOrder([company, orderStop(2, 'Chrastava')], purchases as never);

    expect(result[0].kind).toBe('company');
    expect(result[0].lines).toEqual([
      expect.objectContaining({ name: 'Svijanský Rytíř', quantity: 48 }),
    ]);
    expect(result[1].lines).toEqual([]);
  });

  it("shapes an order stop's products into lines, chip included", () => {
    // stop.products -> lines had zero coverage (orderStop() defaults products to []
    // everywhere else in this file) — deleting that mapping from the order branch
    // would pass every other test. This also exercises platoSizeChipText through
    // lineFrom, the one thing this task lifted out of ShipmentDetail.tsx.
    const stop = orderStop(1, 'Chrastava', [
      { name: 'Kozel 12°', quantity: 24, platoDegree: 12, packageSize: 0.5 },
    ]);

    const result = unloadOrder([stop], []);

    expect(result[0].lines).toEqual([
      { name: 'Kozel 12°', quantity: 24, chip: '12° · 0,5 l' },
    ]);
  });

  it('keeps a custom stop that unloads nothing, even when stock purchases exist', () => {
    // Wire-string kind again ('Custom') — the Custom branch must also normalize
    // rather than compare raw. Non-empty stockPurchases here proves they do NOT leak
    // onto a Custom stop: with an empty stockPurchases array, `lines: []` could not
    // tell "correctly gated by kind" apart from "always empty regardless of input".
    const fuel = new OutgoingShipmentStopDto({
      id: 'fuel', order: 1, kind: 'Custom' as unknown as OutgoingShipmentStopKind,
      label: 'Čerpací stanice', note: 'natankovat',
    } as never);
    const purchases = [{ name: 'Svijanský Rytíř', quantity: 48, packageSize: 0.5 }];

    const result = unloadOrder([fuel], purchases as never);

    expect(result).toHaveLength(1);
    expect(result[0].lines).toEqual([]);
    expect(result[0].note).toBe('natankovat');
  });

  it('returns nothing for a shipment with no stops', () => {
    expect(unloadOrder([], [])).toEqual([]);
  });

  it('numbers sequentially even when the stored orders have gaps', () => {
    const result = unloadOrder([orderStop(3, 'A'), orderStop(9, 'B')], []);

    expect(result.map((s) => s.seq)).toEqual([1, 2]);
  });
});
