import { type ClientDeliveryPlaceDto } from 'src/generated/api-client';

/** A place picked straight off the map has no street — show its coordinates
 * where the address line would go. Ported from the prototype's `placeAddrText`.
 * Split out of `DeliveryPlacesPanel.tsx` into its own module (rather than
 * exported alongside the component) so the panel file only exports a
 * component, keeping `react-refresh/only-export-components` quiet — Tasks 8
 * and 9 both import this directly from here.
 *
 * `place.address` is technically optional on the generated DTO (unlike the
 * prototype's plain object, which always has one), so this guards against
 * that in addition to the prototype's street/city check. */
export function formatPlaceAddress(place: ClientDeliveryPlaceDto): string {
  const a = place.address;
  if (!a) return '—';
  if (a.streetName || a.city) {
    return `${[a.streetName, a.streetNumber].filter(Boolean).join(' ')}, ${a.zip ?? ''} ${a.city ?? ''}`.trim();
  }
  return `${Number(a.latitude).toFixed(4)}, ${Number(a.longitude).toFixed(4)}`;
}
