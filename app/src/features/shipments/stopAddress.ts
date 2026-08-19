// Pure stop-address resolution and <Select> value encoding for the shipment
// editor's stop picker. Split out of ShipmentEditor.tsx (already ~630 lines,
// see app/CLAUDE.md's >500-line rule) so this is testable without a rendering
// harness. Ports the prototype's `stopAddress`/`stopAddressText` (address
// resolution + the stop row's second line) and `seAddrSelect`'s value scheme
// (`cur`/`value` — 'Official' | 'Contact' | `place:<id>`).

import { type OutgoingShipmentOrderDto, type OutgoingShipmentStopDto, DeliveryAddressKind } from 'src/generated/api-client';
import { formatPlaceAddress } from 'src/features/clients/deliveryPlaceFormat';
import { resolveFromAddresses } from 'src/features/clients/deliveryAddress';
import { addrKindValue } from 'src/lib/labels';

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
  addressKind: DeliveryAddressKind,
  deliveryPlaceId?: string,
): { lat?: number; lng?: number; text: string } {
  if (addressKind === DeliveryAddressKind.DeliveryPlace && deliveryPlaceId) {
    const place = order?.clientDeliveryPlaces?.find((p) => p.id === deliveryPlaceId);
    if (place) {
      return { lat: place.address?.latitude, lng: place.address?.longitude, text: `${place.name ?? ''} · ${formatPlaceAddress(place)}` };
    }
  }
  return resolveFromAddresses(addressKind, order?.clientOfficialAddress, order?.clientContactAddress);
}

/** Resolves a shipment-detail stop's map point and address-line text straight
 * off `OutgoingShipmentStopDto`'s own fields. Unlike {@link resolveStopAddress}
 * — which looks a place up by id in an `OutgoingShipmentOrderDto`'s
 * `clientDeliveryPlaces` for the editor's pre-save draft — the shipment
 * detail's read model already carries the resolved `officialAddress` /
 * `contactAddress` / `deliveryPlace` straight on the stop (populated even for
 * a soft-deleted place, so history keeps rendering), so this reads those
 * instead of doing a lookup. Shared by the route map (so a `DeliveryPlace`
 * stop pins at the place, not the billing address) and the stop header's
 * address line.
 *
 * `stop.selectedAddressKind` arrives over the wire as the enum's *string*
 * name (the backend serializes enums as strings — see `src/lib/labels.ts`),
 * while the generated TS enum is numeric. A direct `===` comparison against
 * it is therefore always false for real API data — normalize once here via
 * `addrKindValue` rather than comparing the raw field, and hand the resolved
 * kind back as `isPlace` so callers don't re-derive it themselves. */
export function resolveDetailStopAddress(
  stop: Pick<OutgoingShipmentStopDto, 'selectedAddressKind' | 'officialAddress' | 'contactAddress' | 'deliveryPlace'>,
): { lat?: number; lng?: number; text: string; addressText: string; isPlace: boolean } {
  const kind = addrKindValue(stop.selectedAddressKind);
  if (kind === DeliveryAddressKind.DeliveryPlace && stop.deliveryPlace) {
    const addressText = formatPlaceAddress(stop.deliveryPlace);
    return {
      lat: stop.deliveryPlace.address?.latitude,
      lng: stop.deliveryPlace.address?.longitude,
      text: addressText,
      // A place branch has no kind tail to begin with, so the two are the same string.
      addressText,
      isPlace: true,
    };
  }
  return { ...resolveFromAddresses(kind, stop.officialAddress, stop.contactAddress), isPlace: false };
}
