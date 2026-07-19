import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import L, { type LatLngBoundsExpression, type LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Stack, Typography } from '@mui/material';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import { DEPOT, haversine, fetchRoadRoute, type LatLng, type RoadRoute } from 'src/lib/geo';

export interface RouteStop {
  lat?: number;
  lng?: number;
  label: string;
  color?: string;
}

function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

// A numbered pin drawn as an inline SVG divIcon (same technique as PointMap's
// pinIcon), with the stop's sequence number printed inside.
function numberedPinIcon(color: string, n: number): L.DivIcon {
  const svg = `
    <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.4 15 23 15 23s15-12.6 15-23C30 6.7 23.3 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="15" r="10.5" fill="#fff"/>
      <text x="15" y="19.5" text-anchor="middle" font-size="12" font-weight="800" font-family="sans-serif" fill="${color}">${n}</text>
    </svg>`;
  return L.divIcon({ html: svg, className: 'route-map-pin', iconSize: [30, 38], iconAnchor: [15, 38] });
}

function depotIcon(): L.DivIcon {
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="#1A2B4C" stroke="#fff" stroke-width="2.5"/>
      <path d="M10 15 L16 10 L22 15 V22 H10 Z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
  return L.divIcon({ html: svg, className: 'route-map-depot', iconSize: [32, 32], iconAnchor: [16, 16] });
}

/** Leaflet route map for the shipment screens: the company depot (start + end)
 * plus a numbered marker per stop in delivery order, connected by the actual
 * fastest driving route (OSRM) DEPOT -> stop 1 -> ... -> DEPOT, falling back to
 * straight lines if routing is unavailable. Placeholder when no stop is located. */
export function RouteMap({ stops, height = 340 }: { stops: RouteStop[]; height?: number }) {
  const located = stops.filter((s) => s.lat != null && s.lng != null) as (RouteStop & { lat: number; lng: number })[];

  // Round-trip waypoints: depot -> each located stop (in order) -> depot.
  const waypoints = useMemo<LatLng[]>(
    () => [
      { lat: DEPOT.lat, lng: DEPOT.lng },
      ...located.map((s) => ({ lat: s.lat, lng: s.lng })),
      { lat: DEPOT.lat, lng: DEPOT.lng },
    ],
    [located],
  );
  // Stable key so the routing effect only refires when coordinates change.
  const wpKey = waypoints.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  const [road, setRoad] = useState<RoadRoute | null>(null);
  useEffect(() => {
    setRoad(null);
    if (located.length === 0) return;
    const ctrl = new AbortController();
    fetchRoadRoute(waypoints, ctrl.signal)
      .then((r) => setRoad(r))
      .catch(() => { /* fall back to straight-line geometry + haversine estimate */ });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wpKey]);

  // Straight-line fallback stats (used until/if the road route resolves).
  const fallback = useMemo(() => {
    if (located.length === 0) return null;
    let km = 0;
    for (let i = 1; i < waypoints.length; i++) km += haversine(waypoints[i - 1], waypoints[i]);
    const min = Math.round((km / 45) * 60) + (located.length - 1) * 12;
    return { km: Math.round(km * 10) / 10, min };
  }, [waypoints, located.length]);

  if (located.length === 0) {
    return (
      <Box
        sx={{
          height,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: 'text.disabled',
        }}
      >
        <Box>
          <RouteOutlinedIcon sx={{ fontSize: 30, mb: 1 }} />
          <Typography color="text.secondary">Vyberte objednávky — trasa se vykreslí</Typography>
        </Box>
      </Box>
    );
  }

  const straight: LatLngTuple[] = waypoints.map((p): LatLngTuple => [p.lat, p.lng]);
  const line: LatLngTuple[] = road ? road.path : straight;
  const bounds: LatLngBoundsExpression = straight;
  const stats = road ?? fallback;

  return (
    <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', '& .leaflet-container': { height: '100%', width: '100%' } }}>
      <Box sx={{ height }}>
        <MapContainer bounds={bounds} boundsOptions={{ padding: [40, 40] }} scrollWheelZoom={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Polyline positions={line} pathOptions={{ color: '#F08C00', weight: 4, opacity: 0.9, dashArray: road ? undefined : '9 7' }} />
          <Marker position={[DEPOT.lat, DEPOT.lng]} icon={depotIcon()}>
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>{DEPOT.name}</strong> · start i cíl trasy
              {DEPOT.address ? <><br />{DEPOT.address}</> : null}
            </Tooltip>
          </Marker>
          {located.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lng]} icon={numberedPinIcon(s.color ?? '#F08C00', i + 1)}>
              <Tooltip direction="top" offset={[0, -34]}>
                <strong>{i + 1}. {s.label}</strong>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </Box>
      {stats && (
        <Stack
          direction="row"
          spacing={2.5}
          sx={{
            position: 'absolute', top: 12, left: 12, zIndex: 1000,
            bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5,
            px: 1.75, py: 1.1, boxShadow: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>VZDÁLENOST</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{stats.km} km</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>ČAS (odhad)</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{fmtDur(stats.min)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>ZASTÁVEK</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{located.length}</Typography>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
