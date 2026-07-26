// Pure stop-address resolution and <Select> value encoding for the shipment
// editor's stop picker. Split out of ShipmentEditor.tsx (already ~630 lines,
// see app/CLAUDE.md's >500-line rule) so this is testable without a rendering
// harness. Ports the prototype's `stopAddress`/`stopAddressText` (address
// resolution + the stop row's second line) and `seAddrSelect`'s value scheme
// (`cur`/`value` — 'Official' | 'Contact' | `place:<id>`).

import { type OutgoingShipmentOrderDto, OutgoingShipmentStopAddressKind } from 'src/generated/api-client';
import { formatPlaceAddress, formatStreetAddress } from 'src/features/clients/deliveryPlaceFormat';
import { addrKindLabel } from 'src/lib/labels';

/** Sentinel <Select> value for "+ Nové místo…". Every place id is encoded as
 * `place:<id>` (see {@link encodeStopChoice}) and the two standard kinds
 * encode as their own literal names, so this bare '__new' can't collide with
 * any of them. */
export const NEW_PLACE_CHOICE = '__new';

/** Encodes a stop's chosen address as a <Select> value. The two standard
 * kinds encode as their enum member name; a delivery place is prefixed
 * (`place:<id>`) so a place id can never collide with those two literals —
 * e.g. a place literally named/id'd "Official" still round-trips correctly. */
export function encodeStopChoice(kind: OutgoingShipmentStopAddressKind, deliveryPlaceId?: string): string {
  if (kind === OutgoingShipmentStopAddressKind.DeliveryPlace) return `place:${deliveryPlaceId ?? ''}`;
  return kind === OutgoingShipmentStopAddressKind.Contact ? 'Contact' : 'Official';
}

/** Inverse of {@link encodeStopChoice}. */
export function decodeStopChoice(value: string): { addressKind: OutgoingShipmentStopAddressKind; deliveryPlaceId?: string } {
  if (value.startsWith('place:')) {
    return { addressKind: OutgoingShipmentStopAddressKind.DeliveryPlace, deliveryPlaceId: value.slice('place:'.length) };
  }
  if (value === 'Contact') return { addressKind: OutgoingShipmentStopAddressKind.Contact, deliveryPlaceId: undefined };
  return { addressKind: OutgoingShipmentStopAddressKind.Official, deliveryPlaceId: undefined };
}

/** Resolves a stop's actual destination: coordinates plus the display text
 * used both for the editor row's second line and the shipment detail view.
 *
 * A `DeliveryPlace` kind whose id isn't (or is no longer) in
 * `order.clientDeliveryPlaces` — e.g. the place was soft-deleted since this
 * stop picked it — falls back to the official address here. That is a
 * deliberate limitation of this *pure* resolver: it has no way to keep the
 * stale choice visibly selected. The editor UI is responsible for that (an
 * extra disabled <MenuItem> — see ShipmentEditor's `isGone` handling); this
 * function only guarantees a save built from its output never silently
 * points at nothing. */
export function resolveStopAddress(
  order: OutgoingShipmentOrderDto | undefined,
  addressKind: OutgoingShipmentStopAddressKind,
  deliveryPlaceId?: string,
): { lat?: number; lng?: number; text: string } {
  if (addressKind === OutgoingShipmentStopAddressKind.DeliveryPlace && deliveryPlaceId) {
    const place = order?.clientDeliveryPlaces?.find((p) => p.id === deliveryPlaceId);
    if (place) {
      return { lat: place.address?.latitude, lng: place.address?.longitude, text: `${place.name ?? ''} · ${formatPlaceAddress(place)}` };
    }
  }
  if (addressKind === OutgoingShipmentStopAddressKind.Contact && order?.clientContactAddress) {
    const a = order.clientContactAddress;
    return { lat: a.latitude, lng: a.longitude, text: `${formatStreetAddress(a)} · ${addrKindLabel(OutgoingShipmentStopAddressKind.Contact)}` };
  }
  const a = order?.clientOfficialAddress;
  return { lat: a?.latitude, lng: a?.longitude, text: `${formatStreetAddress(a)} · ${addrKindLabel(OutgoingShipmentStopAddressKind.Official)}` };
}
