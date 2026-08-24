import { describe, expect, it } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget, DeliveryAddressKind, OutgoingShipmentStopDto, OutgoingShipmentStopKind, ProductKind } from 'src/generated/api-client';
import { unloadOrder } from './unloadOrder';

const orderStop = (order: number, clientName: string, products: unknown[] = []) =>
  new OutgoingShipmentStopDto({
    id: `stop-${order}`, order, kind: OutgoingShipmentStopKind.Order, clientName, products,
    orderId: `order-${order}`,
  } as never);

// A client billed through its payer (see the linked-clients-invoicing feature) can be saved
// with no official address at all, and if it also has no contact address the stop has
// nothing to resolve — this is the fixture for that case.
const stopWithNoAddress = () =>
  new OutgoingShipmentStopDto({
    id: 'stop-no-address', order: 1, kind: OutgoingShipmentStopKind.Order, clientName: 'Chrastava',
    orderId: 'order-1', products: [], officialAddress: undefined, contactAddress: undefined,
    selectedAddressKind: DeliveryAddressKind.Official,
  } as never);

const stopWithOfficialAddress = () =>
  new OutgoingShipmentStopDto({
    id: 'stop-official', order: 1, kind: OutgoingShipmentStopKind.Order, clientName: 'Chrastava',
    orderId: 'order-1', products: [],
    officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001', latitude: 50.7, longitude: 15.05 },
    selectedAddressKind: DeliveryAddressKind.Official,
  } as never);

describe('unloadOrder', () => {
  it('lists stops in route order regardless of the order they arrive in', () => {
    const result = unloadOrder([orderStop(2, 'Bílý Kostel'), orderStop(1, 'Chrastava')], [], []);

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

    const result = unloadOrder([company, orderStop(2, 'Chrastava')], purchases as never, []);

    expect(result[0].kind).toBe('company');
    expect(result[0].lines).toEqual([
      expect.objectContaining({ name: 'Svijanský Rytíř', quantity: 48 }),
    ]);
    expect(result[1].lines).toEqual([]);
  });

  it("shapes an order stop's products into lines, chip included", () => {
    // stop.products -> lines had zero coverage (orderStop() defaults products to []
    // everywhere else in this file) — deleting that mapping from the order branch
    // would pass every other test.
    const stop = orderStop(1, 'Chrastava', [
      { name: 'Kozel 12°', quantity: 24, kind: ProductKind.Bottle, platoDegree: 12, packageSize: 0.5 },
    ]);

    const result = unloadOrder([stop], [], []);

    expect(result[0].lines).toEqual([
      { name: 'Kozel 12°', quantity: 24, chip: 'Basa · 0,5 l · 12°' },
    ]);
  });

  it('tells the same beer in two packages apart by its kind, not by the degree they share', () => {
    // The complaint the chip was rebuilt for: three rows reading 'Svijanský Kníže' whose only
    // difference was a package size at the far right. Kind leads the chip now.
    //
    // 'Keg' as the wire STRING, the shape a raw `=== ProductKind.Keg` comparison gets wrong
    // while the numeric fixture above would let it slide.
    const stop = orderStop(1, 'Chrastava', [
      { name: 'Svijanský Kníže', quantity: 2, kind: 'Keg', platoDegree: 13, packageSize: 30 },
      { name: 'Svijanský Kníže', quantity: 1, kind: ProductKind.Bottle, platoDegree: 13, packageSize: 0.5 },
    ]);

    const result = unloadOrder([stop], [], []);

    expect(result[0].lines.map((l) => l.chip)).toEqual([
      'Sud · 30 l · 13°',
      'Basa · 0,5 l · 13°',
    ]);
  });

  it('counts the pieces coming off at each stop', () => {
    // What the driver checks the handover against, so it counts every line — the beer and the
    // supplier goods alike.
    const stop = orderStop(1, 'Chrastava', [
      { name: 'Kozel 12°', quantity: 24, kind: ProductKind.Bottle, platoDegree: 12, packageSize: 0.5 },
    ]);
    const goods = [{ id: 'line-1', name: 'CO₂ láhev', size: '10 kg', quantity: 2, orderId: 'order-1' }];

    const result = unloadOrder([stop], [], goods as never);

    expect(result[0].totalQuantity).toBe(26);
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

    const result = unloadOrder([fuel], purchases as never, []);

    expect(result).toHaveLength(1);
    expect(result[0].lines).toEqual([]);
    expect(result[0].note).toBe('natankovat');
  });

  it('leaves out a supplier pickup, keeping the route numbers the map shows', () => {
    // The complaint: a supplier set as the first stop showed up in the vykládka as a
    // nameless "Bez vykládky" row — the van calls there to collect, not to unload.
    // Wire-string kind again ('Supplier'), the shape a raw enum comparison gets wrong.
    //
    // The remaining stop stays "2", not renumbered to "1": the pins on the map and the
    // rows in Přehled zastávek number the whole route, so renumbering here would have
    // the driver's list and the map disagree about which stop is which.
    const linde = new OutgoingShipmentStopDto({
      id: 'pickup', order: 1, kind: 'Supplier' as unknown as OutgoingShipmentStopKind, label: 'Linde Gas',
    } as never);

    const result = unloadOrder([linde, orderStop(2, 'Chrastava')], [], []);

    expect(result.map((s) => [s.seq, s.title])).toEqual([[2, 'Chrastava']]);
  });

  it('leaves out the warehouse when nothing is bought for stock', () => {
    // A run that only fetches garage-sourced supplier goods gets the company stop too, and
    // there it is a pickup like the supplier's — nothing comes off the van. The stop with
    // stock purchases on it is covered above, so this asserts the difference between the two
    // reasons the stop can exist, not "company stops are never listed".
    const hq = new OutgoingShipmentStopDto({
      id: 'hq', order: 1, kind: 'Company' as unknown as OutgoingShipmentStopKind, label: 'AleTrack s.r.o.',
    } as never);

    const result = unloadOrder([hq, orderStop(2, 'Chrastava')], [], []);

    expect(result.map((s) => [s.seq, s.title])).toEqual([[2, 'Chrastava']]);
  });

  it("hands the order's supplier goods over at its own stop, after the beer", () => {
    // Supplier goods hang off the run, not off the stop, so they have to be matched back to it
    // by order — the whole point of the `orderId` on both sides.
    const stop = orderStop(1, 'Chrastava', [
      { name: 'Kozel 12°', quantity: 24, kind: ProductKind.Bottle, platoDegree: 12, packageSize: 0.5 },
    ]);
    const goods = [{ id: 'line-1', name: 'CO₂ láhev', size: '10 kg', quantity: 2, orderId: 'order-1' }];

    const result = unloadOrder([stop], [], goods as never);

    // Named as supplier goods rather than left chipless: a CO₂ bottle has no kind, and a bare
    // '10 kg' beside the beer's 'Basa · 0,5 l · 12°' reads as a line missing its chip.
    //
    // toMatchObject, not toEqual: a line also carries the id a recorded deviation points at,
    // which this assertion is not about.
    expect(result[0].lines).toMatchObject([
      { name: 'Kozel 12°', quantity: 24, chip: 'Basa · 0,5 l · 12°' },
      { name: 'CO₂ láhev', quantity: 2, chip: 'Zboží dodavatele · 10 kg' },
    ]);
  });

  it("does not put one order's supplier goods on another order's stop", () => {
    // The failure a `supplierGoods.map(...)` with no filter produces: every client gets every
    // run's extra goods read out at their door.
    const goods = [{ id: 'line-1', name: 'CO₂ láhev', size: '10 kg', quantity: 2, orderId: 'order-1' }];

    const result = unloadOrder([orderStop(1, 'Chrastava'), orderStop(2, 'Bílý Kostel')], [], goods as never);

    expect(result[0].lines.map((l) => l.name)).toEqual(['CO₂ láhev']);
    expect(result[1].lines).toEqual([]);
  });

  it('hands over every piece, whichever way it was collected', () => {
    // The garage/supplier split says where the van picks the pieces up. All of them still go to
    // the client, so a line that reported only the supplier-sourced half would short the delivery.
    const goods = [{
      id: 'line-1', name: 'CO₂ láhev', size: '10 kg', quantity: 5, quantityFromGarage: 3, orderId: 'order-1',
    }];

    const result = unloadOrder([orderStop(1, 'Chrastava')], [], goods as never);

    expect(result[0].lines).toMatchObject([
      { name: 'CO₂ láhev', quantity: 5, chip: 'Zboží dodavatele · 10 kg' },
    ]);
  });

  it('returns nothing for a shipment with no stops', () => {
    expect(unloadOrder([], [], [])).toEqual([]);
  });

  it('numbers sequentially even when the stored orders have gaps', () => {
    const result = unloadOrder([orderStop(3, 'A'), orderStop(9, 'B')], [], []);

    expect(result.map((s) => s.seq)).toEqual([1, 2]);
  });

  it('flags a stop whose client has no address at all', () => {
    // Nothing blocks saving such a client, so the shipment is where it has to be visible.
    const stops = unloadOrder([stopWithNoAddress()], [], []);

    expect(stops[0].addressMissing).toBe(true);
    expect(stops[0].subtitle ?? '').toBe('');
  });

  it('does not flag a stop that resolves an address', () => {
    const stops = unloadOrder([stopWithOfficialAddress()], [], []);

    expect(stops[0].addressMissing).toBe(false);
  });
});

// ---------------------------------------------------------------------------------
// Deviations. The handover is the one moment a plan and a reality exist side by side, and the
// unload list is the view of it — the nakládka, settled with the brewery before the van left,
// stays out of it entirely.
// ---------------------------------------------------------------------------------

describe('unloadOrder — deviations', () => {
  const CLIENT = 'client-a';
  const ORDER = 'order-1';
  const ITEM = 'item-1';

  function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
    return ClientLedgerEntryDto.fromJS({
      id: `e-${Math.random()}`,
      clientId: CLIENT,
      orderId: ORDER,
      target: ClientLedgerEntryTarget.ProductQuantity,
      requiresFollowUp: false,
      createdAt: '2026-08-24T10:00:00Z',
      ...over,
    });
  }

  /** A stop whose product carries the order-item id a deviation points at. */
  function stopWithItem(): OutgoingShipmentStopDto {
    const stop = orderStop(1, 'Chrastava', [
      { name: 'Kozel 12°', quantity: 10, kind: ProductKind.Keg, platoDegree: 12, packageSize: 50 },
    ]);
    stop.clientId = CLIENT;
    stop.orderId = ORDER;
    (stop.products ?? []).forEach((p) => { p.orderItemId = ITEM; });
    return stop;
  }

  function ledger(...entries: ClientLedgerEntryDto[]) {
    return new Map([[CLIENT, entries]]);
  }

  it('leaves the lines alone with no ledger in hand', () => {
    const result = unloadOrder([stopWithItem()], [], []);

    expect(result[0].lines[0].diff).toBeUndefined();
    expect(result[0].openChanges).toBe(0);
    expect(result[0].totalQuantity).toBe(10);
  });

  it('diffs a line against what came off', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      ledger(entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })),
    );

    expect(result[0].lines[0].diff).toMatchObject({
      status: 'changed', plannedQuantity: 10, actualQuantity: 7,
    });
  });

  // The number beside the client's name is what the driver counts the handover against, so it
  // has to be what actually comes off rather than what the office planned.
  it('counts the stop by what actually comes off', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      ledger(entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })),
    );

    expect(result[0].totalQuantity).toBe(7);
  });

  it('appends a product the client took at the door', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      ledger(entry({ productId: 'p-9', productName: 'Světlé 10', plannedQuantity: 0, actualQuantity: 4 })),
    );

    expect(result[0].lines).toHaveLength(2);
    expect(result[0].lines[1]).toMatchObject({ name: 'Světlé 10', chip: 'Vzato na místě' });
    expect(result[0].lines[1].diff?.status).toBe('added');
  });

  it('badges the stop with how many changes are still open', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      ledger(
        entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7, requiresFollowUp: true }),
        entry({ target: ClientLedgerEntryTarget.Money, amount: 500, requiresFollowUp: true }),
        entry({
          target: ClientLedgerEntryTarget.Money,
          amount: 200,
          resolvedAt: new Date('2026-08-26T09:00:00Z'),
        }),
      ),
    );

    expect(result[0].openChanges).toBe(2);
  });

  // Returns and extras go the other way — the driver takes the empties, the client signs for the
  // loan — so they are a different transaction at the same doorstep and keep their own cards.
  it('keeps returns and extras out of the unload lines', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      ledger(entry({
        target: ClientLedgerEntryTarget.ReturnQuantity,
        lineName: 'Basy prázdných',
        plannedQuantity: 0,
        actualQuantity: 4,
      })),
    );

    expect(result[0].lines).toHaveLength(1);
    expect(result[0].lines[0].name).toBe('Kozel 12°');
  });

  it('ignores a deviation recorded against another order', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      ledger(entry({ orderId: 'some-other-order', orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })),
    );

    expect(result[0].lines[0].diff?.status).toBe('unchanged');
    expect(result[0].openChanges).toBe(0);
  });

  it('ignores another client\'s ledger', () => {
    const result = unloadOrder(
      [stopWithItem()], [], [],
      new Map([['client-b', [entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })]]]),
    );

    expect(result[0].lines[0].diff).toBeUndefined();
  });
});
