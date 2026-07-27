import { describe, expect, it } from 'vitest';
import { resolveDetailStopAddress, resolveStopAddress } from 'src/features/shipments/stopAddress';
import { DeliveryAddressKind } from 'src/generated/api-client';

const place = { id: 'p1', name: 'Letní zahrádka', note: undefined,
  address: { streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', latitude: 50.9, longitude: 14.8 } };
const order = {
  clientOfficialAddress: { streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', latitude: 50.897, longitude: 14.808 },
  clientContactAddress: { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', latitude: 50.88, longitude: 14.81 },
  clientDeliveryPlaces: [place],
} as never;

describe('resolveStopAddress', () => {
  it('uses the official address by default', () => {
    expect(resolveStopAddress(order, DeliveryAddressKind.Official).lat).toBe(50.897);
  });

  it('uses the contact address when selected', () => {
    expect(resolveStopAddress(order, DeliveryAddressKind.Contact).lat).toBe(50.88);
  });

  it('uses the place coordinates when one is selected', () => {
    const r = resolveStopAddress(order, DeliveryAddressKind.DeliveryPlace, 'p1');
    expect(r.lat).toBe(50.9);
    expect(r.text).toContain('Letní zahrádka');
  });

  it('falls back to the official address when the place is not in the list', () => {
    // A soft-deleted place is absent from clientDeliveryPlaces. Falling back
    // silently would relocate the delivery, so the caller must keep the stale
    // selection visible — this only guards the pure resolver.
    expect(resolveStopAddress(order, DeliveryAddressKind.DeliveryPlace, 'gone').lat).toBe(50.897);
  });
});

describe('resolveDetailStopAddress', () => {
  const officialAddress = { streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', latitude: 50.897, longitude: 14.808 };
  const contactAddress = { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', latitude: 50.88, longitude: 14.81 };

  it('uses the official address by default', () => {
    const r = resolveDetailStopAddress({ selectedAddressKind: DeliveryAddressKind.Official, officialAddress } as never);
    expect(r.lat).toBe(50.897);
    expect(r.text).toBe('Náměstí 14, 02763 Žitava · Fakturační');
  });

  it('uses the contact address when selected (numeric wire form)', () => {
    const r = resolveDetailStopAddress({ selectedAddressKind: DeliveryAddressKind.Contact, officialAddress, contactAddress } as never);
    expect(r.lat).toBe(50.88);
    expect(r.text).toBe('Dvůr 2a, 02763 Žitava · Kontaktní');
  });

  // The backend serializes enums as strings on the wire (JsonStringEnumConverter,
  // Program.cs), so `selectedAddressKind` really arrives as "Contact", not the
  // numeric 1. A direct `===` against the numeric enum member — the bug this
  // test guards — silently falls through to the official-address branch here.
  it('uses the contact address when selected (string wire form)', () => {
    const r = resolveDetailStopAddress({ selectedAddressKind: 'Contact' as unknown as DeliveryAddressKind, officialAddress, contactAddress } as never);
    expect(r.lat).toBe(50.88);
    expect(r.text).toBe('Dvůr 2a, 02763 Žitava · Kontaktní');
    expect(r.isPlace).toBe(false);
  });

  it('uses the place coordinates and formatted address (without the name) when a place is selected (numeric wire form)', () => {
    const r = resolveDetailStopAddress({
      selectedAddressKind: DeliveryAddressKind.DeliveryPlace,
      officialAddress,
      deliveryPlace: { name: 'Letní zahrádka', address: place.address },
    } as never);
    expect(r.lat).toBe(50.9);
    expect(r.text).toBe('Nábřežní 3, 02763 Žitava');
    expect(r.text).not.toContain('Letní zahrádka');
    expect(r.isPlace).toBe(true);
  });

  // Same wire-form guard as the Contact test above, for the DeliveryPlace
  // branch — the actual bug reported by the whole-branch review: a stop
  // saved with a delivery place showed the billing address on the detail
  // screen because "DeliveryPlace" === 2 is false.
  it('uses the place coordinates and formatted address when a place is selected (string wire form)', () => {
    const r = resolveDetailStopAddress({
      selectedAddressKind: 'DeliveryPlace' as unknown as DeliveryAddressKind,
      officialAddress,
      deliveryPlace: { name: 'Letní zahrádka', address: place.address },
    } as never);
    expect(r.lat).toBe(50.9);
    expect(r.text).toBe('Nábřežní 3, 02763 Žitava');
    expect(r.isPlace).toBe(true);
  });

  it('falls back to the official address when the kind is DeliveryPlace but no place is loaded', () => {
    // Mirrors resolveStopAddress's fallback: a save must never silently point
    // at nothing even if the caller forgot to load the place.
    const r = resolveDetailStopAddress({ selectedAddressKind: DeliveryAddressKind.DeliveryPlace, officialAddress } as never);
    expect(r.lat).toBe(50.897);
  });
});

describe('resolveStopAddress and resolveDetailStopAddress agree on the shared tail', () => {
  // The same stop renders on both the editor and the detail screen. Both
  // resolvers delegate their Contact/Official branch to one private helper —
  // this guards against a future edit landing on only one of the two call
  // sites (wording, separator, or the Contact-falls-back-to-Official rule).
  const officialAddress = { streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', latitude: 50.897, longitude: 14.808 };
  const contactAddress = { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', latitude: 50.88, longitude: 14.81 };

  it('produce the identical string for the same Official stop', () => {
    const editorText = resolveStopAddress(order, DeliveryAddressKind.Official).text;
    const detailText = resolveDetailStopAddress({ selectedAddressKind: DeliveryAddressKind.Official, officialAddress } as never).text;
    expect(editorText).toBe(detailText);
  });

  it('produce the identical string for the same Contact stop', () => {
    const editorText = resolveStopAddress(order, DeliveryAddressKind.Contact).text;
    const detailText = resolveDetailStopAddress({ selectedAddressKind: DeliveryAddressKind.Contact, officialAddress, contactAddress } as never).text;
    expect(editorText).toBe(detailText);
  });
});
