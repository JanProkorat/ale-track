// Deep links that hand a planned shipment route over to an external navigation
// app. Pure URL builders — kept next to geo.ts so the route card and its tests
// share one definition of what each provider can actually take.
//
// The providers differ in how many stops they take, which is the whole reason
// this module exists:
//   * Google Maps — round trip, at most 9 waypoints (Maps URL API limit).
//   * Mapy.com    — round trip, at most 15 waypoints; `navigate=true` starts
//                   turn-by-turn straight away in the app (April 2024+).
//
// Apple Maps is deliberately absent: its URL scheme has no waypoints parameter
// (`daddr` takes one destination, and Google's `+to:` chaining is ignored), so a
// link can only ever seed the first leg of a delivery round.
//
// Via points are deliberately not passed through: they are OSRM shaping points,
// and every provider here would render them as real stops to arrive at.

import type { LatLng } from 'src/lib/geo';

/** Google's Maps URL API accepts at most this many intermediate waypoints. */
export const GOOGLE_MAX_WAYPOINTS = 9;

/** Mapy.com's `/fnc/v1/route` accepts at most this many waypoints. */
export const MAPY_MAX_WAYPOINTS = 15;

/** A ready-to-open external navigation link. `omitted` counts the stops that
 * did not fit the provider's limits, so the UI can say so instead of silently
 * handing the driver a shorter route than the one on screen. */
export interface NavLink {
  url: string;
  omitted: number;
}

/** Six decimals is ~11 cm — far past what a delivery address needs, and short
 * enough to keep the URL readable. `Number(...)` drops the trailing zeros
 * `toFixed` leaves behind without ever reaching exponential notation at these
 * magnitudes. */
function coord(value: number): number {
  return Number(value.toFixed(6));
}

function latLng(p: LatLng): string {
  return `${coord(p.lat)},${coord(p.lng)}`;
}

function lngLat(p: LatLng): string {
  return `${coord(p.lng)},${coord(p.lat)}`;
}

/** Round trip depot → stops → depot in Google Maps. Opens the native app on
 * iOS/Android and the web planner on desktop. */
export function googleMapsRouteLink(depot: LatLng, stops: LatLng[]): NavLink | null {
  if (stops.length === 0) {
    return null;
  }
  const fitting = stops.slice(0, GOOGLE_MAX_WAYPOINTS);
  const params = new URLSearchParams({
    api: '1',
    origin: latLng(depot),
    destination: latLng(depot),
    travelmode: 'driving',
  });
  params.set('waypoints', fitting.map(latLng).join('|'));
  return { url: `https://www.google.com/maps/dir/?${params.toString()}`, omitted: stops.length - fitting.length };
}

/** Round trip depot → stops → depot in Mapy.com, with navigation armed. */
export function mapyRouteLink(depot: LatLng, stops: LatLng[]): NavLink | null {
  if (stops.length === 0) {
    return null;
  }
  const fitting = stops.slice(0, MAPY_MAX_WAYPOINTS);
  const params = new URLSearchParams({
    mapset: 'traffic',
    start: lngLat(depot),
    end: lngLat(depot),
    routeType: 'car_fast_traffic',
    waypoints: fitting.map(lngLat).join(';'),
    navigate: 'true',
  });
  return { url: `https://mapy.com/fnc/v1/route?${params.toString()}`, omitted: stops.length - fitting.length };
}
