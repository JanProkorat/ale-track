// What the route's stop list says about each kind of stop, and how it numbers them.

import { describe, expect, it } from 'vitest';
import {
  AddressDto,
  ClientDeliveryPlaceDto,
  Country,
  DeliveryAddressKind,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
} from 'src/generated/api-client';
import { stopOverviewEntries } from './stopOverview';

function address(over: Partial<AddressDto> = {}): AddressDto {
  return new AddressDto({
    streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', country: Country.Czechia,
    latitude: 50.897, longitude: 14.808, ...over,
  });
}

function orderStop(over: Partial<OutgoingShipmentStopDto> = {}): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-order',
    order: 1,
    // The backend serializes enums as strings; the resolver has to cope with that form.
    kind: 'Order' as unknown as OutgoingShipmentStopKind,
    orderId: 'order-1',
    clientId: 'client-a',
    clientName: 'Restaurace B',
    officialAddress: address(),
    selectedAddressKind: 'Official' as unknown as DeliveryAddressKind,
    ...over,
  });
}

function supplierStop(over: Partial<OutgoingShipmentStopDto> = {}): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-supplier',
    order: 2,
    kind: 'Supplier' as unknown as OutgoingShipmentStopKind,
    label: 'Linde Gas',
    supplierId: 's-linde',
    supplierAddress: address({ streetName: 'Průmyslová', streetNumber: '3', city: 'Liberec', zip: '46001' }),
    latitude: 50.77,
    longitude: 15.05,
    ...over,
  });
}

function companyStop(over: Partial<OutgoingShipmentStopDto> = {}): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-company',
    order: 3,
    kind: 'Company' as unknown as OutgoingShipmentStopKind,
    label: 'Sklad AleTrack',
    ...over,
  });
}

function customStop(over: Partial<OutgoingShipmentStopDto> = {}): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-custom',
    order: 4,
    kind: 'Custom' as unknown as OutgoingShipmentStopKind,
    label: 'Čerpací stanice',
    note: 'Natankovat',
    ...over,
  });
}

describe('stopOverviewEntries', () => {
  it('describes a client delivery by its client and resolved address', () => {
    const [entry] = stopOverviewEntries([orderStop()]);

    expect(entry.kind).toBe('order');
    expect(entry.title).toBe('Restaurace B');
    expect(entry.addressLine).toBe('Náměstí 14, 02763 Žitava');
    // No "· Fakturační" tail — which address it is only matters in the editor.
    expect(entry.addressLine).not.toMatch(/Fakturační/);
    expect(entry.orderId).toBe('order-1');
  });

  it('names a delivery place separately from the address, without repeating it', () => {
    const [entry] = stopOverviewEntries([orderStop({
      selectedAddressKind: 'DeliveryPlace' as unknown as DeliveryAddressKind,
      deliveryPlace: new ClientDeliveryPlaceDto({
        id: 'place-1', name: 'Letní zahrádka', address: address({ streetName: 'Nábřežní', streetNumber: '3' }),
      }),
    })]);

    expect(entry.placeName).toBe('Letní zahrádka');
    expect(entry.addressLine).not.toMatch(/Letní zahrádka/);
  });

  // The point of this change: a supplier pickup is a stop and belongs in the list.
  it('describes a supplier pickup by its label and the supplier address', () => {
    const [entry] = stopOverviewEntries([supplierStop()]);

    expect(entry.kind).toBe('supplier');
    expect(entry.title).toBe('Linde Gas');
    expect(entry.addressLine).toBe('Průmyslová 3, 46001 Liberec');
    // Nothing to open: a pickup stop has no order behind it.
    expect(entry.orderId).toBeUndefined();
  });

  // The label was written when the stop was created, so it survives the supplier's removal.
  it('falls back to the stop\'s own label when the supplier address is gone', () => {
    const [entry] = stopOverviewEntries([supplierStop({ supplierAddress: undefined })]);

    expect(entry.title).toBe('Linde Gas');
    expect(entry.addressLine).toBeUndefined();
  });

  it('describes the warehouse stop', () => {
    const [entry] = stopOverviewEntries([companyStop()]);

    expect(entry.kind).toBe('company');
    expect(entry.title).toBe('Sklad AleTrack');
  });

  it('describes a custom waypoint, carrying its note where the address would go', () => {
    const [entry] = stopOverviewEntries([customStop()]);

    expect(entry.kind).toBe('custom');
    expect(entry.title).toBe('Čerpací stanice');
    expect(entry.note).toBe('Natankovat');
  });

  // The reason the list carries every kind: these numbers are the map pins' numbers. Listing
  // only order stops made the second delivery read as "2" while its pin said "3".
  it('numbers by route position across every kind', () => {
    const entries = stopOverviewEntries([
      orderStop({ id: 's1', orderId: 'order-1' }),
      companyStop({ id: 's2' }),
      orderStop({ id: 's3', orderId: 'order-2', clientName: 'Hospoda C' }),
      supplierStop({ id: 's4' }),
    ]);

    expect(entries.map((e) => [e.seq, e.title])).toEqual([
      [1, 'Restaurace B'],
      [2, 'Sklad AleTrack'],
      [3, 'Hospoda C'],
      [4, 'Linde Gas'],
    ]);
  });

  it('gives every entry a distinct key, even for stops of the same kind', () => {
    const entries = stopOverviewEntries([
      supplierStop({ id: 'a' }),
      supplierStop({ id: 'b' }),
    ]);

    expect(new Set(entries.map((e) => e.key)).size).toBe(2);
  });

  it('returns nothing for a run with no stops', () => {
    expect(stopOverviewEntries([])).toEqual([]);
  });
});
