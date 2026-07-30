import { describe, expect, it } from 'vitest';
import { googleMapsRouteLink, mapyRouteLink, GOOGLE_MAX_WAYPOINTS, MAPY_MAX_WAYPOINTS } from './routeLinks';

const depot = { lat: 50.0878, lng: 14.4606 };
const stopA = { lat: 50.0831, lng: 14.5377 };
const stopB = { lat: 50.0335, lng: 14.5087 };

function manyStops(n: number) {
  return Array.from({ length: n }, (_, i) => ({ lat: 50 + i / 100, lng: 14 + i / 100 }));
}

describe('googleMapsRouteLink', () => {
  it('builds a round trip with the depot at both ends and stops as waypoints', () => {
    const link = googleMapsRouteLink(depot, [stopA, stopB]);
    expect(link).not.toBeNull();
    const url = new URL(link!.url);
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('origin')).toBe('50.0878,14.4606');
    expect(url.searchParams.get('destination')).toBe('50.0878,14.4606');
    expect(url.searchParams.get('waypoints')).toBe('50.0831,14.5377|50.0335,14.5087');
    expect(url.searchParams.get('travelmode')).toBe('driving');
    expect(link!.omitted).toBe(0);
  });

  it('returns null when the route has no located stops', () => {
    expect(googleMapsRouteLink(depot, [])).toBeNull();
  });

  it('caps the waypoints at the URL API limit and reports what was dropped', () => {
    const stops = manyStops(GOOGLE_MAX_WAYPOINTS + 3);
    const link = googleMapsRouteLink(depot, stops);
    const waypoints = new URL(link!.url).searchParams.get('waypoints')!.split('|');
    expect(waypoints).toHaveLength(GOOGLE_MAX_WAYPOINTS);
    expect(link!.omitted).toBe(3);
  });
});

describe('mapyRouteLink', () => {
  it('builds a round trip with lon,lat coordinates and semicolon-separated waypoints', () => {
    const link = mapyRouteLink(depot, [stopA, stopB]);
    const url = new URL(link!.url);
    expect(url.origin + url.pathname).toBe('https://mapy.com/fnc/v1/route');
    expect(url.searchParams.get('start')).toBe('14.4606,50.0878');
    expect(url.searchParams.get('end')).toBe('14.4606,50.0878');
    expect(url.searchParams.get('waypoints')).toBe('14.5377,50.0831;14.5087,50.0335');
    expect(url.searchParams.get('routeType')).toBe('car_fast_traffic');
    expect(url.searchParams.get('navigate')).toBe('true');
    expect(link!.omitted).toBe(0);
  });

  it('returns null when the route has no located stops', () => {
    expect(mapyRouteLink(depot, [])).toBeNull();
  });

  it('caps the waypoints at the documented limit and reports what was dropped', () => {
    const stops = manyStops(MAPY_MAX_WAYPOINTS + 2);
    const link = mapyRouteLink(depot, stops);
    const waypoints = new URL(link!.url).searchParams.get('waypoints')!.split(';');
    expect(waypoints).toHaveLength(MAPY_MAX_WAYPOINTS);
    expect(link!.omitted).toBe(2);
  });
});

describe('coordinate formatting', () => {
  it('rounds to six decimals without scientific notation', () => {
    const link = googleMapsRouteLink({ lat: 50.12345678, lng: 14.00000001 }, [stopA]);
    expect(new URL(link!.url).searchParams.get('origin')).toBe('50.123457,14');
  });
});
