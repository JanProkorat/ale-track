import { describe, expect, it } from 'vitest';
import { decodeStopChoice, encodeStopChoice, resolveDetailStopAddress, resolveStopAddress } from 'src/features/shipments/stopAddress';
import { OutgoingShipmentStopAddressKind } from 'src/generated/api-client';

const place = { id: 'p1', name: 'Letní zahrádka', note: undefined,
  address: { streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', latitude: 50.9, longitude: 14.8 } };
const order = {
  clientOfficialAddress: { streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', latitude: 50.897, longitude: 14.808 },
  clientContactAddress: { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', latitude: 50.88, longitude: 14.81 },
  clientDeliveryPlaces: [place],
} as never;

describe('resolveStopAddress', () => {
  it('uses the official address by default', () => {
    expect(resolveStopAddress(order, OutgoingShipmentStopAddressKind.Official).lat).toBe(50.897);
  });

  it('uses the contact address when selected', () => {
    expect(resolveStopAddress(order, OutgoingShipmentStopAddressKind.Contact).lat).toBe(50.88);
  });

  it('uses the place coordinates when one is selected', () => {
    const r = resolveStopAddress(order, OutgoingShipmentStopAddressKind.DeliveryPlace, 'p1');
    expect(r.lat).toBe(50.9);
    expect(r.text).toContain('Letní zahrádka');
  });

  it('falls back to the official address when the place is not in the list', () => {
    // A soft-deleted place is absent from clientDeliveryPlaces. Falling back
    // silently would relocate the delivery, so the caller must keep the stale
    // selection visible — this only guards the pure resolver.
    expect(resolveStopAddress(order, OutgoingShipmentStopAddressKind.DeliveryPlace, 'gone').lat).toBe(50.897);
  });
});

describe('resolveDetailStopAddress', () => {
  const officialAddress = { streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', latitude: 50.897, longitude: 14.808 };
  const contactAddress = { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', latitude: 50.88, longitude: 14.81 };

  it('uses the official address by default', () => {
    const r = resolveDetailStopAddress({ selectedAddressKind: OutgoingShipmentStopAddressKind.Official, officialAddress } as never);
    expect(r.lat).toBe(50.897);
    expect(r.text).toBe('Náměstí 14, 02763 Žitava · Fakturační');
  });

  it('uses the contact address when selected', () => {
    const r = resolveDetailStopAddress({ selectedAddressKind: OutgoingShipmentStopAddressKind.Contact, officialAddress, contactAddress } as never);
    expect(r.lat).toBe(50.88);
    expect(r.text).toBe('Dvůr 2a, 02763 Žitava · Kontaktní');
  });

  it('uses the place coordinates and formatted address (without the name) when a place is selected', () => {
    const r = resolveDetailStopAddress({
      selectedAddressKind: OutgoingShipmentStopAddressKind.DeliveryPlace,
      officialAddress,
      deliveryPlace: { name: 'Letní zahrádka', address: place.address },
    } as never);
    expect(r.lat).toBe(50.9);
    expect(r.text).toBe('Nábřežní 3, 02763 Žitava');
    expect(r.text).not.toContain('Letní zahrádka');
  });

  it('falls back to the official address when the kind is DeliveryPlace but no place is loaded', () => {
    // Mirrors resolveStopAddress's fallback: a save must never silently point
    // at nothing even if the caller forgot to load the place.
    const r = resolveDetailStopAddress({ selectedAddressKind: OutgoingShipmentStopAddressKind.DeliveryPlace, officialAddress } as never);
    expect(r.lat).toBe(50.897);
  });
});

describe('stop choice encoding', () => {
  it('round-trips the two standard kinds', () => {
    expect(decodeStopChoice(encodeStopChoice(OutgoingShipmentStopAddressKind.Official)))
      .toEqual({ addressKind: OutgoingShipmentStopAddressKind.Official, deliveryPlaceId: undefined });
    expect(decodeStopChoice(encodeStopChoice(OutgoingShipmentStopAddressKind.Contact)))
      .toEqual({ addressKind: OutgoingShipmentStopAddressKind.Contact, deliveryPlaceId: undefined });
  });

  it('round-trips a place', () => {
    expect(decodeStopChoice(encodeStopChoice(OutgoingShipmentStopAddressKind.DeliveryPlace, 'p1')))
      .toEqual({ addressKind: OutgoingShipmentStopAddressKind.DeliveryPlace, deliveryPlaceId: 'p1' });
  });

  it('prefixes place IDs so they cannot collide with the standard values', () => {
    expect(encodeStopChoice(OutgoingShipmentStopAddressKind.DeliveryPlace, 'Official')).toBe('place:Official');
  });
});
