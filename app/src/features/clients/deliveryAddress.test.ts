import { describe, expect, it } from 'vitest';
import { DeliveryAddressKind, type AddressDto, type ClientDeliveryPlaceDto } from 'src/generated/api-client';
import {
  decodeStopChoice, defaultAddressKind, encodeStopChoice, resolveFromAddresses, resolveOrderDeliveryAddress,
} from './deliveryAddress';

const official = { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' } as AddressDto;
const contact = { streetName: 'Vedlejší', streetNumber: '2', city: 'Jablonec', zip: '46601' } as AddressDto;
const place = {
  id: 'p1', name: 'Letní zahrádka', note: 'Vjezd zezadu',
  address: { latitude: 50.7, longitude: 15.05 },
} as ClientDeliveryPlaceDto;

describe('choice encoding', () => {
  it('round-trips a place whose id is the literal "Official"', () => {
    const encoded = encodeStopChoice(DeliveryAddressKind.DeliveryPlace, 'Official');
    expect(decodeStopChoice(encoded)).toEqual({
      addressKind: DeliveryAddressKind.DeliveryPlace,
      deliveryPlaceId: 'Official',
    });
  });

  it('round-trips the two standard kinds', () => {
    expect(decodeStopChoice(encodeStopChoice(DeliveryAddressKind.Contact)).addressKind)
      .toBe(DeliveryAddressKind.Contact);
    expect(decodeStopChoice(encodeStopChoice(DeliveryAddressKind.Official)).addressKind)
      .toBe(DeliveryAddressKind.Official);
  });
});

describe('resolveOrderDeliveryAddress', () => {
  it('uses the official address for the Official kind', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [], DeliveryAddressKind.Official);
    expect(r.text).toContain('Hlavní');
    expect(r.placeName).toBeUndefined();
  });

  it('uses the contact address for the Contact kind', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [], DeliveryAddressKind.Contact);
    expect(r.text).toContain('Vedlejší');
  });

  it('returns the place name and note for a place, falling back to coordinates with no street', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [place], DeliveryAddressKind.DeliveryPlace, 'p1');
    expect(r.placeName).toBe('Letní zahrádka');
    expect(r.placeNote).toBe('Vjezd zezadu');
    expect(r.text).toContain('50.7000');
  });

  // A place soft-deleted since the order chose it is no longer in the list.
  // The preview must not silently claim the billing address is the place.
  it('falls back to the official address when the place id is unknown', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [], DeliveryAddressKind.DeliveryPlace, 'gone');
    expect(r.text).toContain('Hlavní');
    expect(r.placeName).toBeUndefined();
  });
});

describe('resolveFromAddresses', () => {
  it('falls through to the contact address when there is no official one', () => {
    // A sub-client billed through its payer has no official address, and an Official kind
    // would otherwise render a blank line.
    const contact = { streetName: 'Dlouhá', streetNumber: '14', city: 'Brno', zip: '60200', latitude: 49.2, longitude: 16.6 };

    const r = resolveFromAddresses(DeliveryAddressKind.Official, undefined, contact as AddressDto);

    expect(r.addressText).toContain('Dlouhá');
    expect(r.lat).toBe(49.2);
  });

  it('returns an empty address text when the client has neither address', () => {
    const r = resolveFromAddresses(DeliveryAddressKind.Official, undefined, undefined);

    expect(r.addressText.trim()).toBe('');
    expect(r.lat).toBeUndefined();
  });
});

const address = (): AddressDto => ({
  streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001', latitude: 50.7, longitude: 15.05,
} as AddressDto);

describe('defaultAddressKind', () => {
  it('prefers the official address when the client has one', () => {
    const r = defaultAddressKind(address(), address(), []);

    expect(r.addressKind).toBe(DeliveryAddressKind.Official);
    expect(r.deliveryPlaceId).toBeUndefined();
  });

  it('falls back to the contact address when there is no official one', () => {
    const r = defaultAddressKind(undefined, address(), []);

    expect(r.addressKind).toBe(DeliveryAddressKind.Contact);
  });

  it('falls back to the first delivery place when the client has neither address', () => {
    const r = defaultAddressKind(undefined, undefined, [{ id: 'place-1' } as ClientDeliveryPlaceDto]);

    expect(r.addressKind).toBe(DeliveryAddressKind.DeliveryPlace);
    expect(r.deliveryPlaceId).toBe('place-1');
  });

  it('falls back to Official when the client has nothing at all', () => {
    // The warning on the shipment is what tells the user; the picker still needs a value.
    const r = defaultAddressKind(undefined, undefined, []);

    expect(r.addressKind).toBe(DeliveryAddressKind.Official);
  });
});
