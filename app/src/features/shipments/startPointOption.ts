import { DeliveryAddressKind, ShipmentStartPointKind } from 'src/generated/api-client';
import type { RouteEndpoint } from 'src/components/common/RouteMap';
import { addrKindName, startPointKindName } from 'src/lib/labels';

/** A start point value as carried by the editor's draft: enough to identify
 * which entry from `useShipmentStartPoints()` was chosen, without the rest of
 * that entry's (server-owned) display fields. `addressKind` is undefined for
 * the company entry and for a brewery entry that predates this field; it is
 * part of a brewery entry's identity because a brewery now contributes one
 * entry per address it has set (Official, plus Contact when set) — a bare
 * `breweryId` alone no longer picks out a single entry. */
export interface StartPointValue {
  kind: ShipmentStartPointKind;
  breweryId?: string;
  addressKind?: DeliveryAddressKind;
}

/** Stable <Select> value for a start point — the company has no id of its own,
 * so it is keyed by its kind while a brewery is keyed by its id plus which of
 * its addresses this entry is. Compares through `startPointKindName` /
 * `addrKindName` rather than `=== ShipmentStartPointKind.Company` /
 * `=== DeliveryAddressKind.Contact` — the backend serializes enums as JSON
 * strings while the generated TS enum is numeric, so a raw `===` against the
 * numeric member never matches live data (see `src/lib/labels.ts`). Pulled
 * into its own module (rather than living alongside `StartPointPicker`) so
 * that component file only exports the component itself. */
export function optionKey(point: { kind?: ShipmentStartPointKind | string; breweryId?: string; addressKind?: DeliveryAddressKind | string }): string {
  if (startPointKindName(point.kind) === 'Company') return 'company';
  return `brewery:${point.breweryId ?? ''}:${addrKindName(point.addressKind) ?? 'Official'}`;
}

/** A place with a name and, maybe, coordinates — either a `ShipmentStartPointDto`
 * or the shipment detail DTO's own resolved start point, whose fields carry the
 * same meaning under different names. */
export interface LocatablePoint {
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  address?: string | null;
}

/** The map endpoint for a start point, or `undefined` when it has no coordinates
 * to plot.
 *
 * The start-points endpoint deliberately lists breweries whose address was never
 * geocoded — a legal choice the map simply cannot draw. Coercing those nulls to
 * zero (`latitude ?? 0`) does not degrade gracefully: it plants the marker off
 * West Africa and, worse, seeds the nearest-neighbour optimizer with (0, 0) as
 * the run's origin, which reorders every stop by distance from null island.
 * Returning `undefined` instead lets each caller fall through to something real. */
export function routeEndpointFrom(point: LocatablePoint | undefined | null): RouteEndpoint | undefined {
  if (point?.latitude == null || point.longitude == null) return undefined;
  return {
    lat: point.latitude,
    lng: point.longitude,
    name: point.name ?? '—',
    address: point.address ?? undefined,
  };
}
