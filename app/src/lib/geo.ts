// Small geo helpers shared by the shipment route map and the editor's
// nearest-neighbour route optimizer. Kept out of RouteMap.tsx so that
// component file only exports the component (react-refresh/only-export-components).

export interface LatLng {
  lat: number;
  lng: number;
}

/** The company depot — every outgoing shipment starts and ends here. Read from
 * the `VITE_COMPANY_ADDRESS` env JSON (supports both `latitude/longitude` and
 * `lat/lng` shapes); falls back to a Žitava-area default if unset/malformed. */
export const DEPOT: LatLng & { name: string; address?: string } = readDepot();

function readDepot(): LatLng & { name: string; address?: string } {
  const fallback = { lat: 50.897, lng: 14.807, name: 'Sklad' };
  const raw = import.meta.env.VITE_COMPANY_ADDRESS;
  if (!raw) return fallback;
  try {
    const c = JSON.parse(raw) as Record<string, unknown>;
    const lat = Number(c.latitude ?? c.lat);
    const lng = Number(c.longitude ?? c.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;
    const street = [c.streetName, c.streetNumber].filter(Boolean).join(' ').trim();
    const address = [street, c.city].filter(Boolean).join(', ') || undefined;
    const name = (c.label as string) || (c.city ? `Sklad — ${c.city}` : 'Sklad');
    return { lat, lng, name, address };
  } catch {
    return fallback;
  }
}

/** Great-circle distance in km. */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const d2r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d2r;
  const dLng = (b.lng - a.lng) * d2r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d2r) * Math.cos(b.lat * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export interface RoadRoute {
  /** Full road-following geometry as [lat, lng] tuples for a Leaflet Polyline. */
  path: [number, number][];
  km: number;
  min: number;
}

/** Fetch the actual fastest driving route through `points` (in order) from the
 * public OSRM demo server, returning road-following geometry + real distance/
 * duration. Rejects on network/HTTP error so callers can fall back to straight
 * lines. `signal` aborts an in-flight request when inputs change or on unmount. */
export async function fetchRoadRoute(points: LatLng[], signal?: AbortSignal): Promise<RoadRoute> {
  if (points.length < 2) throw new Error('need at least two points');
  // OSRM expects lng,lat pairs separated by semicolons.
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) throw new Error(`OSRM ${data.code}`);
  return {
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    km: Math.round((route.distance / 1000) * 10) / 10,
    min: Math.round(route.duration / 60),
  };
}
