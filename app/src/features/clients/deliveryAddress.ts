// Pure delivery-address choice-encoding and resolution helpers, shared by the
// shipment stop picker, the shipment detail resolver (see stopAddress.ts) and
// the order editor's preview line. Originally split out of ShipmentEditor.tsx
// (already ~630 lines, see app/CLAUDE.md's >500-line rule); moved here from
// stopAddress.ts once the order editor needed them too, so there is one shared
// home instead of two call sites drifting apart.

import { type AddressDto, type ClientDeliveryPlaceDto, DeliveryAddressKind } from 'src/generated/api-client';
import { formatPlaceAddress, formatStreetAddress } from 'src/features/clients/deliveryPlaceFormat';
import { addrKindLabel } from 'src/lib/labels';

/** The `address · kind` tail shared by both resolvers below for the two
 * standard kinds (Contact falls back to Official when there's no contact
 * address). Neither resolver's place branch goes through here — they
 * legitimately differ: the editor prefixes the place's name (it has no
 * separate chip to carry it), the detail is address-only (its chip already
 * shows the name). Kept as one function so a wording/separator/fallback
 * change can't land on only one of the two screens the same stop renders on.
 *
 * `addressText` is the same address without the ` · kind` tail, for the screens
 * that only need to say *where* — returned alongside rather than as a flag, so the
 * two can never be formatted from different address fields. */
export function resolveFromAddresses(
  kind: DeliveryAddressKind,
  official: AddressDto | undefined,
  contact: AddressDto | undefined,
): { lat?: number; lng?: number; text: string; addressText: string } {
  if (kind === DeliveryAddressKind.Contact && contact) {
    const addressText = formatStreetAddress(contact);
    return { lat: contact.latitude, lng: contact.longitude, text: `${addressText} · ${addrKindLabel(DeliveryAddressKind.Contact)}`, addressText };
  }
  const addressText = formatStreetAddress(official);
  return { lat: official?.latitude, lng: official?.longitude, text: `${addressText} · ${addrKindLabel(DeliveryAddressKind.Official)}`, addressText };
}

/** Sentinel <Select> value for "+ Nové místo…". Every place id is encoded as
 * `place:<id>` (see {@link encodeStopChoice}) and the two standard kinds
 * encode as their own literal names, so this bare '__new' can't collide with
 * any of them. */
export const NEW_PLACE_CHOICE = '__new';

/** Encodes a stop's chosen address as a <Select> value. The two standard
 * kinds encode as their enum member name; a delivery place is prefixed
 * (`place:<id>`) so a place id can never collide with those two literals —
 * e.g. a place literally named/id'd "Official" still round-trips correctly. */
export function encodeStopChoice(kind: DeliveryAddressKind, deliveryPlaceId?: string): string {
  if (kind === DeliveryAddressKind.DeliveryPlace) return `place:${deliveryPlaceId ?? ''}`;
  return kind === DeliveryAddressKind.Contact ? 'Contact' : 'Official';
}

/** Inverse of {@link encodeStopChoice}. */
export function decodeStopChoice(value: string): { addressKind: DeliveryAddressKind; deliveryPlaceId?: string } {
  if (value.startsWith('place:')) {
    return { addressKind: DeliveryAddressKind.DeliveryPlace, deliveryPlaceId: value.slice('place:'.length) };
  }
  if (value === 'Contact') return { addressKind: DeliveryAddressKind.Contact, deliveryPlaceId: undefined };
  return { addressKind: DeliveryAddressKind.Official, deliveryPlaceId: undefined };
}

/** Resolves an order's chosen delivery address for the editor's preview line.
 * Unlike the shipment-detail resolver, this works off the client's raw
 * addresses and place list, because the order editor's draft is not saved yet
 * and has no server-resolved read model to read from.
 *
 * A `DeliveryPlace` kind whose id is not in `places` — the place was
 * soft-deleted since the order chose it — falls back to the official address,
 * matching `resolveStopAddress`. The *picker* is what keeps the stale choice
 * visibly selected; this function only guarantees the preview never claims a
 * destination that no longer exists. */
export function resolveOrderDeliveryAddress(
  official: AddressDto | undefined,
  contact: AddressDto | undefined,
  places: ClientDeliveryPlaceDto[],
  kind: DeliveryAddressKind,
  placeId?: string,
): { text: string; placeName?: string; placeNote?: string } {
  if (kind === DeliveryAddressKind.DeliveryPlace && placeId) {
    const place = places.find((p) => p.id === placeId);
    if (place) {
      return { text: formatPlaceAddress(place), placeName: place.name, placeNote: place.note ?? undefined };
    }
  }
  return { text: resolveFromAddresses(kind, official, contact).text };
}
