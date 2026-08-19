// Which pickup stops a run needs, predicted on the client so the list moves on the click.
//
// The cases mirror SupplierPickupStopReconcilerTests on the API side deliberately: this module and
// that reconciler answer the same two questions, and the pair of test files is what makes a change
// to one of them visible as a failure against the other's expectations.

import { describe, expect, it } from 'vitest';
import {
  AddressDto,
  Country,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
  OutgoingShipmentSupplierGoodDto,
  SupplierGoodPickupSource,
} from 'src/generated/api-client';
import { predictPickupStops, withSplitApplied } from './pickupStopPrediction';
import { stopKindName } from 'src/lib/labels';

const LINDE = 's-linde';
const OBALY = 's-obaly';

function address(city: string, lat: number, lng: number): AddressDto {
  return new AddressDto({
    streetName: 'Průmyslová', streetNumber: '3', city, zip: '46001', country: Country.Czechia,
    latitude: lat, longitude: lng,
  });
}

function good(over: Partial<OutgoingShipmentSupplierGoodDto> = {}): OutgoingShipmentSupplierGoodDto {
  return new OutgoingShipmentSupplierGoodDto({
    id: 'line-1',
    supplierGoodId: 'g-co2',
    name: 'CO₂ láhev',
    quantity: 2,
    quantityFromGarage: 0,
    pickupSource: SupplierGoodPickupSource.Supplier,
    supplierId: LINDE,
    supplierName: 'Linde Gas',
    supplierAddress: address('Liberec', 50.77, 15.05),
    ...over,
  });
}

function orderStop(): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-order', order: 1,
    kind: 'Order' as unknown as OutgoingShipmentStopKind,
    orderId: 'order-1', clientName: 'Restaurace B',
  });
}

function supplierStop(supplierId: string, order = 2): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: `stop-${supplierId}`, order,
    kind: 'Supplier' as unknown as OutgoingShipmentStopKind,
    label: 'Linde Gas', supplierId,
  });
}

function companyStop(order = 3): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-company', order,
    kind: 'Company' as unknown as OutgoingShipmentStopKind,
    label: 'Sklad AleTrack',
  });
}

const COMPANY = { name: 'Sklad AleTrack', latitude: 50.84, longitude: 14.83 };

function kinds(stops: OutgoingShipmentStopDto[]): (string | undefined)[] {
  return stops.map((s) => stopKindName(s.kind));
}

describe('predictPickupStops — supplier stops', () => {
  it('keeps the stop while any piece is still collected there', () => {
    const stops = predictPickupStops({
      stops: [orderStop(), supplierStop(LINDE)],
      supplierGoods: [good({ quantity: 4, quantityFromGarage: 3 })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(stops.filter((s) => stopKindName(s.kind) === 'Supplier')).toHaveLength(1);
  });

  it('drops the stop once every piece comes from the garage', () => {
    const stops = predictPickupStops({
      stops: [orderStop(), supplierStop(LINDE)],
      supplierGoods: [good({ quantity: 2, quantityFromGarage: 2 })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(kinds(stops)).toEqual(['Order', 'Company']);
  });

  it('adds a stop, with its address, when a piece moves back to the supplier', () => {
    const stops = predictPickupStops({
      stops: [orderStop()],
      supplierGoods: [good({ quantity: 2, quantityFromGarage: 0 })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    const added = stops.find((s) => stopKindName(s.kind) === 'Supplier')!;
    expect(added.label).toBe('Linde Gas');
    expect(added.supplierId).toBe(LINDE);
    // Coordinates too, so the map pins it without waiting for the run to be re-read.
    expect(added.latitude).toBe(50.77);
    expect(added.longitude).toBe(15.05);
    // Appended, as the server appends it.
    expect(added.order).toBe(2);
  });

  // A stop the server has not acknowledged has no id, which is what makes every consumer treat
  // it as not addressable — the reorder controls hide rather than posting an unknown id.
  it('leaves an added stop without an id', () => {
    const stops = predictPickupStops({
      stops: [orderStop()],
      supplierGoods: [good()],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(stops.find((s) => stopKindName(s.kind) === 'Supplier')!.id).toBeUndefined();
  });

  it('adds one stop per supplier, in name order', () => {
    const stops = predictPickupStops({
      stops: [orderStop()],
      supplierGoods: [
        good({ id: 'l-1', supplierId: OBALY, supplierName: 'Obaly Morava' }),
        good({ id: 'l-2', supplierId: LINDE, supplierName: 'Linde Gas' }),
      ],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(stops.filter((s) => stopKindName(s.kind) === 'Supplier').map((s) => s.label))
      .toEqual(['Linde Gas', 'Obaly Morava']);
  });

  it('adds one stop for two orders wanting the same supplier', () => {
    const stops = predictPickupStops({
      stops: [orderStop()],
      supplierGoods: [good({ id: 'l-1' }), good({ id: 'l-2' })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(stops.filter((s) => stopKindName(s.kind) === 'Supplier')).toHaveLength(1);
  });

  // A planner may have put the plnírna deliberately mid-route.
  it('leaves an existing stop where it is', () => {
    const stops = predictPickupStops({
      stops: [supplierStop(LINDE, 1), orderStop()],
      supplierGoods: [good()],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(stops.find((s) => stopKindName(s.kind) === 'Supplier')!.order).toBe(1);
  });

  it('leaves order and custom stops untouched', () => {
    const custom = new OutgoingShipmentStopDto({
      id: 'stop-custom', order: 4,
      kind: 'Custom' as unknown as OutgoingShipmentStopKind,
      label: 'Čerpací stanice',
    });

    const stops = predictPickupStops({
      stops: [orderStop(), custom],
      supplierGoods: [],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(kinds(stops)).toEqual(['Order', 'Custom']);
  });
});

describe('predictPickupStops — the warehouse stop', () => {
  it('appears for a garage-sourced piece, even with nothing bought for stock', () => {
    const stops = predictPickupStops({
      stops: [orderStop()],
      supplierGoods: [good({ quantity: 2, quantityFromGarage: 1 })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    const added = stops.find((s) => stopKindName(s.kind) === 'Company')!;
    expect(added.label).toBe('Sklad AleTrack');
    expect(added.latitude).toBe(50.84);
  });

  it('goes once the last garage piece moves back to the supplier', () => {
    const stops = predictPickupStops({
      stops: [orderStop(), companyStop()],
      supplierGoods: [good({ quantity: 2, quantityFromGarage: 0 })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(kinds(stops)).toContain('Supplier');
    expect(kinds(stops)).not.toContain('Company');
  });

  // Two reasons for one stop, so neither may remove it on the other's behalf.
  it('stays for stock purchases even with no garage pieces', () => {
    const stops = predictPickupStops({
      stops: [orderStop(), companyStop()],
      supplierGoods: [good({ quantity: 2, quantityFromGarage: 0 })],
      hasStockPurchases: true,
      company: COMPANY,
    });

    expect(kinds(stops)).toContain('Company');
  });

  it('is not duplicated when one is already there', () => {
    const stops = predictPickupStops({
      stops: [orderStop(), companyStop()],
      supplierGoods: [good({ quantity: 2, quantityFromGarage: 2 })],
      hasStockPurchases: false,
      company: COMPANY,
    });

    expect(stops.filter((s) => stopKindName(s.kind) === 'Company')).toHaveLength(1);
  });

  // The start-points query may still be pending; the stop is still worth drawing.
  it('is added without coordinates when the company point is unknown', () => {
    const stops = predictPickupStops({
      stops: [orderStop()],
      supplierGoods: [good({ quantity: 1, quantityFromGarage: 1 })],
      hasStockPurchases: false,
      company: undefined,
    });

    const added = stops.find((s) => stopKindName(s.kind) === 'Company')!;
    expect(added).toBeDefined();
    expect(added.latitude).toBeUndefined();
  });
});

describe('withSplitApplied', () => {
  it('changes only the named line', () => {
    const next = withSplitApplied([good({ id: 'l-1' }), good({ id: 'l-2' })], 'l-2', 2);

    expect(next[0].quantityFromGarage).toBe(0);
    expect(next[1].quantityFromGarage).toBe(2);
  });

  it('keeps the DTO usable rather than degrading it to a plain object', () => {
    const [line] = withSplitApplied([good()], 'line-1', 1);

    expect(line).toBeInstanceOf(OutgoingShipmentSupplierGoodDto);
    expect(typeof line.toJSON).toBe('function');
  });
});
