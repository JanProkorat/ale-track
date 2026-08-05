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

  it('puts the stock purchases on the company stop', () => {
    const company = new OutgoingShipmentStopDto({
      id: 'hq', order: 2, kind: OutgoingShipmentStopKind.Company, label: 'AleTrack s.r.o.',
    } as never);
    const purchases = [{ name: 'Svijanský Rytíř', quantity: 48, packageSize: 0.5 }];

    const result = unloadOrder([orderStop(1, 'Chrastava'), company], purchases as never);

    expect(result[1].kind).toBe('company');
    expect(result[1].lines).toEqual([
      expect.objectContaining({ name: 'Svijanský Rytíř', quantity: 48 }),
    ]);
  });

  it('keeps a custom stop that unloads nothing', () => {
    const fuel = new OutgoingShipmentStopDto({
      id: 'fuel', order: 1, kind: OutgoingShipmentStopKind.Custom,
      label: 'Čerpací stanice', note: 'natankovat',
    } as never);

    const result = unloadOrder([fuel], []);

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
