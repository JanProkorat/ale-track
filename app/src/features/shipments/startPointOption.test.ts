// The Select value that keys a start-point entry. A brewery now contributes one entry per
// address it has set (Official, plus Contact when set), so a bare `breweryId` no longer
// identifies an entry — `optionKey` must fold in `addressKind` too, and it must do so through
// the string-name normalizer (`addrKindName`), not a raw `===` against the numeric enum member,
// because the real backend serializes every enum as its string name.

import { describe, expect, it } from 'vitest';
import { DeliveryAddressKind, ShipmentStartPointKind } from 'src/generated/api-client';
import { optionKey } from './startPointOption';

describe('optionKey', () => {
  it('keys the company entry as "company" regardless of any other field', () => {
    expect(optionKey({ kind: ShipmentStartPointKind.Company })).toBe('company');
    expect(optionKey({ kind: 'Company' as unknown as ShipmentStartPointKind })).toBe('company');
  });

  it('gives a brewery\'s Official and Contact entries distinct keys', () => {
    // Without addressKind folded in, both entries below would collapse to the same
    // `brewery:svijany` key and the <Select> could never distinguish them — picking
    // the second option in the list would silently re-select the first.
    const official = optionKey({
      kind: ShipmentStartPointKind.Brewery,
      breweryId: 'svijany',
      addressKind: DeliveryAddressKind.Official,
    });
    const contact = optionKey({
      kind: ShipmentStartPointKind.Brewery,
      breweryId: 'svijany',
      addressKind: DeliveryAddressKind.Contact,
    });

    expect(official).not.toBe(contact);
  });

  it('resolves the wire string form of addressKind, not just the numeric enum', () => {
    // The real backend serializes DeliveryAddressKind as its name ('Contact'), while the
    // generated TS enum is numeric (DeliveryAddressKind.Contact === 1). A raw `===` against
    // the numeric member would never match this shape, so a Contact entry would silently
    // collapse onto the Official one — this is the exact bug class the brief calls out as
    // having bitten this feature four times already.
    const officialWire = optionKey({
      kind: 'Brewery' as unknown as ShipmentStartPointKind,
      breweryId: 'svijany',
      addressKind: 'Official' as unknown as DeliveryAddressKind,
    });
    const contactWire = optionKey({
      kind: 'Brewery' as unknown as ShipmentStartPointKind,
      breweryId: 'svijany',
      addressKind: 'Contact' as unknown as DeliveryAddressKind,
    });

    expect(officialWire).not.toBe(contactWire);
    // And the wire-string form must key identically to the numeric-enum form, so a value
    // loaded from the server and one just picked in the <Select> compare equal.
    expect(contactWire).toBe(optionKey({
      kind: ShipmentStartPointKind.Brewery,
      breweryId: 'svijany',
      addressKind: DeliveryAddressKind.Contact,
    }));
  });

  it('defaults a brewery entry with no addressKind to the Official key', () => {
    // A brewery entry with only one address (no Contact address set) carries no
    // addressKind at all — it must still key identically to an explicit Official pick,
    // so the <Select> shows it as selected rather than falling through to "no match".
    const noKind = optionKey({ kind: ShipmentStartPointKind.Brewery, breweryId: 'frydlant' });
    const explicitOfficial = optionKey({
      kind: ShipmentStartPointKind.Brewery,
      breweryId: 'frydlant',
      addressKind: DeliveryAddressKind.Official,
    });

    expect(noKind).toBe(explicitOfficial);
  });

  it('keys two different breweries apart even at the same address kind', () => {
    const svijany = optionKey({ kind: ShipmentStartPointKind.Brewery, breweryId: 'svijany', addressKind: DeliveryAddressKind.Official });
    const frydlant = optionKey({ kind: ShipmentStartPointKind.Brewery, breweryId: 'frydlant', addressKind: DeliveryAddressKind.Official });

    expect(svijany).not.toBe(frydlant);
  });
});
