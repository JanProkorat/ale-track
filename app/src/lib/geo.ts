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

/** A postal address to geocode. `country` is the English country name or ISO
 * code Nominatim understands (e.g. "Czechia", "Germany", "cz"). */
export interface GeocodeAddress {
  streetName?: string;
  streetNumber?: string;
  city?: string;
  zip?: string;
  country?: string;
}

/** Resolve an address to coordinates via OpenStreetMap Nominatim. Tries a
 * structured query first, then falls back to a free-form one. Returns null when
 * nothing matches or the request fails — callers should treat coords as
 * optional (the map just won't plot that point). */
export async function geocodeAddress(a: GeocodeAddress, signal?: AbortSignal): Promise<LatLng | null> {
  const base = 'https://nominatim.openstreetmap.org/search';
  const street = [a.streetName, a.streetNumber].filter(Boolean).join(' ').trim();

  const run = async (params: URLSearchParams): Promise<LatLng | null> => {
    params.set('format', 'jsonv2');
    params.set('limit', '1');
    const res = await fetch(`${base}?${params.toString()}`, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = Array.isArray(data) ? data[0] : undefined;
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };

  try {
    // Structured query — most precise when the parts are clean.
    const structured = new URLSearchParams();
    if (street) structured.set('street', street);
    if (a.city) structured.set('city', a.city);
    if (a.zip) structured.set('postalcode', a.zip);
    if (a.country) structured.set('country', a.country);
    if ([...structured.keys()].length > 0) {
      const hit = await run(structured);
      if (hit) return hit;
    }
    // Fallback — free-form, catches addresses the structured search misses.
    const q = [street, a.zip, a.city, a.country].filter(Boolean).join(', ').trim();
    if (!q) return null;
    return await run(new URLSearchParams({ q }));
  } catch {
    return null;
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

/** Fetch the fastest driving route(s) through `points` (in order) from the
 * public OSRM demo server. Returns road-following geometry + real distance/
 * duration; routes[0] is the primary. With `alternatives`, OSRM may return a
 * few options. Rejects on network/HTTP error so callers can fall back. */
export async function fetchRoadRoute(points: LatLng[], opts?: { signal?: AbortSignal; alternatives?: boolean }): Promise<RoadRoute[]> {
  if (points.length < 2) throw new Error('need at least two points');
  // OSRM expects lng,lat pairs separated by semicolons.
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const alt = opts?.alternatives ? '&alternatives=3' : '';
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson${alt}`;
  const res = await fetch(url, { signal: opts?.signal });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(`OSRM ${data.code}`);
  return data.routes.map((route) => ({
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    km: Math.round((route.distance / 1000) * 10) / 10,
    min: Math.round(route.duration / 60),
  }));
}

/** Squared distance from point p to segment a-b (in lat/lng space; fine for the
 * short local distances here), plus the projection parameter t in [0,1]. */
function segDist(p: LatLng, a: LatLng, b: LatLng): { d2: number; t: number } {
  const vx = b.lng - a.lng, vy = b.lat - a.lat;
  const wx = p.lng - a.lng, wy = p.lat - a.lat;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = a.lng + t * vx, cy = a.lat + t * vy;
  const dx = p.lng - cx, dy = p.lat - cy;
  return { d2: dx * dx + dy * dy, t };
}

/** Insert each via point into the ordered `base` waypoint list at its nearest
 * segment (ordered along that segment), producing the full OSRM waypoint
 * sequence. Vias store only coordinates; their placement is derived here so it
 * stays correct as stops move. */
export function insertVias(base: LatLng[], vias: LatLng[]): LatLng[] {
  if (vias.length === 0 || base.length < 2) return base;
  // For each segment index, collect the vias assigned to it with their t.
  const perSegment = new Map<number, { via: LatLng; t: number }[]>();
  for (const via of vias) {
    let bestSeg = 0, bestD2 = Infinity, bestT = 0;
    for (let i = 0; i < base.length - 1; i++) {
      const { d2, t } = segDist(via, base[i], base[i + 1]);
      if (d2 < bestD2) { bestD2 = d2; bestSeg = i; bestT = t; }
    }
    const arr = perSegment.get(bestSeg) ?? [];
    arr.push({ via, t: bestT });
    perSegment.set(bestSeg, arr);
  }
  const out: LatLng[] = [];
  for (let i = 0; i < base.length; i++) {
    out.push(base[i]);
    if (i < base.length - 1) {
      const seg = perSegment.get(i);
      if (seg) for (const { via } of seg.sort((x, y) => x.t - y.t)) out.push(via);
    }
  }
  return out;
}

/** Pick the vertex of `alt` farthest from the `primary` polyline — a good via
 * to bias future routing toward the chosen alternative. */
export function viaFromAlternative(primary: [number, number][], alt: [number, number][]): LatLng {
  let best: LatLng = { lat: alt[0][0], lng: alt[0][1] };
  let bestMin = -1;
  for (const [lat, lng] of alt) {
    let minD2 = Infinity;
    for (const [plat, plng] of primary) {
      const dx = lng - plng, dy = lat - plat;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD2) minD2 = d2;
    }
    if (minD2 > bestMin) { bestMin = minD2; best = { lat, lng }; }
  }
  return best;
}
