import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import L, { type LatLngBoundsExpression, type LatLngTuple, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Stack, Tooltip as MuiTooltip, Typography } from '@mui/material';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import FullscreenIcon from '@mui/icons-material/FullscreenOutlined';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExitOutlined';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrongOutlined';
import AltRouteIcon from '@mui/icons-material/AltRouteOutlined';
import { DEPOT, haversine, fetchRoadRoute, insertVias, viaFromAlternative, type LatLng, type RoadRoute } from 'src/lib/geo';

function viaIcon(): L.DivIcon {
  const svg = '<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="6" fill="#fff" stroke="#F08C00" stroke-width="3.5"/></svg>';
  return L.divIcon({ html: svg, className: 'route-map-via', iconSize: [18, 18], iconAnchor: [9, 9] });
}

export interface RouteStop {
  lat?: number;
  lng?: number;
  label: string;
  color?: string;
  /** 'custom' stops render as a diamond waypoint; 'order' (default) as a pin. */
  kind?: 'order' | 'custom';
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

// A diamond waypoint for custom (non-order) stops, with its sequence number.
function customPinIcon(color: string, n: number): L.DivIcon {
  const svg = `
    <svg width="32" height="38" viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0 L32 16 L16 30 L0 16 Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <text x="16" y="20.5" text-anchor="middle" font-size="12" font-weight="800" font-family="sans-serif" fill="#fff">${n}</text>
    </svg>`;
  return L.divIcon({ html: svg, className: 'route-map-custom', iconSize: [32, 38], iconAnchor: [16, 30] });
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
 * plus a numbered marker per stop, connected by the actual fastest driving
 * route (OSRM). In editable mode the route can be reshaped with via points —
 * click the route to drop one, drag to move, click to remove — and OSRM
 * alternatives can be shown and adopted. Placeholder when no stop is located. */
export function RouteMap({
  stops, height = 340, viaPoints = [], editable = false, onViasChange,
}: {
  stops: RouteStop[];
  height?: number;
  viaPoints?: LatLng[];
  editable?: boolean;
  onViasChange?: (vias: LatLng[]) => void;
}) {
  const located = stops.filter((s) => s.lat != null && s.lng != null) as (RouteStop & { lat: number; lng: number })[];

  // Callers pass 280–360px, which eats most of a phone screen. Cap on mobile
  // rather than taking a responsive prop, so every call site benefits as-is.
  const mapHeight = { xs: Math.min(height, 260), mobile: height };

  // Base round-trip: depot -> each located stop (in order) -> depot.
  const base = useMemo<LatLng[]>(
    () => [
      { lat: DEPOT.lat, lng: DEPOT.lng },
      ...located.map((s) => ({ lat: s.lat, lng: s.lng })),
      { lat: DEPOT.lat, lng: DEPOT.lng },
    ],
    [located],
  );
  // Full sequence with via points inserted at their nearest segment.
  const full = useMemo(() => insertVias(base, viaPoints), [base, viaPoints]);
  const fullKey = full.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  const baseKey = base.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  const [showAlts, setShowAlts] = useState(false);
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const [alts, setAlts] = useState<RoadRoute[]>([]);

  // Primary route (through vias).
  useEffect(() => {
    setRoad(null);
    if (located.length === 0) return;
    const ctrl = new AbortController();
    fetchRoadRoute(full, { signal: ctrl.signal })
      .then((r) => setRoad(r[0] ?? null))
      .catch(() => { /* fall back to straight-line geometry + haversine estimate */ });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  // Alternatives (base route, editable + toggled on).
  useEffect(() => {
    setAlts([]);
    if (!editable || !showAlts || located.length === 0) return;
    const ctrl = new AbortController();
    fetchRoadRoute(base, { signal: ctrl.signal, alternatives: true })
      .then((r) => setAlts(r.slice(1)))
      .catch(() => { /* alternatives are optional */ });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, editable, showAlts]);

  const addVia = (lat: number, lng: number) => onViasChange?.([...viaPoints, { lat, lng }]);
  const moveVia = (i: number, lat: number, lng: number) => onViasChange?.(viaPoints.map((v, idx) => (idx === i ? { lat, lng } : v)));
  const removeVia = (i: number) => onViasChange?.(viaPoints.filter((_, idx) => idx !== i));
  const adoptAlt = (alt: RoadRoute) => { if (road) onViasChange?.([...viaPoints, viaFromAlternative(road.path, alt.path)]); };

  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [isFull, setIsFull] = useState(false);
  // Track native fullscreen and re-measure the map so tiles fill the new size.
  useEffect(() => {
    const onChange = () => {
      setIsFull(document.fullscreenElement === wrapRef.current);
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Straight-line fallback stats (used until/if the road route resolves).
  const fallback = useMemo(() => {
    if (located.length === 0) return null;
    let km = 0;
    for (let i = 1; i < full.length; i++) km += haversine(full[i - 1], full[i]);
    const min = Math.round((km / 45) * 60) + (located.length - 1) * 12;
    return { km: Math.round(km * 10) / 10, min };
  }, [full, located.length]);

  if (located.length === 0) {
    return (
      <Box
        sx={{
          height: mapHeight,
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

  const straight: LatLngTuple[] = full.map((p): LatLngTuple => [p.lat, p.lng]);
  const boundsPts: LatLngTuple[] = base.map((p): LatLngTuple => [p.lat, p.lng]);
  const line: LatLngTuple[] = road ? road.path : straight;
  const bounds: LatLngBoundsExpression = boundsPts;
  const stats = road ?? fallback;

  const fitRoute = () => mapRef.current?.fitBounds(boundsPts, { padding: [40, 40] });
  const toggleFull = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: 'relative', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider',
        '& .leaflet-container': { height: '100%', width: '100%' },
        '&:fullscreen': { borderRadius: 0, width: '100%', height: '100%' },
      }}
    >
      <Box sx={{ height: isFull ? '100%' : mapHeight }}>
        <MapContainer ref={mapRef} bounds={bounds} boundsOptions={{ padding: [40, 40] }} zoomControl={false} scrollWheelZoom={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Alternative routes (behind the primary), clickable to adopt. */}
          {editable && alts.map((alt, i) => (
            <Polyline
              key={`alt-${i}`}
              positions={alt.path}
              pathOptions={{ color: '#5A6675', weight: 4, opacity: 0.55, dashArray: '4 9', lineCap: 'round' }}
              eventHandlers={{ click: () => adoptAlt(alt) }}
            >
              <Tooltip sticky>Použít tuto trasu · {alt.km} km · {fmtDur(alt.min)}</Tooltip>
            </Polyline>
          ))}
          <Polyline
            positions={line}
            pathOptions={{ color: '#F08C00', weight: 4, opacity: 0.9, dashArray: road ? undefined : '9 7' }}
            eventHandlers={editable ? { click: (e) => addVia(e.latlng.lat, e.latlng.lng) } : undefined}
          >
            {editable && <Tooltip sticky>Klikni pro přidání průjezdového bodu</Tooltip>}
          </Polyline>
          {/* Via points — draggable to move, click to remove (editable only). */}
          {editable && viaPoints.map((v, i) => (
            <Marker
              key={`via-${i}`}
              position={[v.lat, v.lng]}
              draggable
              icon={viaIcon()}
              eventHandlers={{
                dragend: (e) => { const ll = e.target.getLatLng(); moveVia(i, ll.lat, ll.lng); },
                click: () => removeVia(i),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>Průjezdový bod · klikni pro odebrání</Tooltip>
            </Marker>
          ))}
          <Marker position={[DEPOT.lat, DEPOT.lng]} icon={depotIcon()}>
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>{DEPOT.name}</strong> · start i cíl trasy
              {DEPOT.address ? <><br />{DEPOT.address}</> : null}
            </Tooltip>
          </Marker>
          {located.map((s, i) => (
            <Marker
              key={i}
              position={[s.lat, s.lng]}
              icon={s.kind === 'custom' ? customPinIcon(s.color ?? '#1A2B4C', i + 1) : numberedPinIcon(s.color ?? '#F08C00', i + 1)}
            >
              <Tooltip direction="top" offset={[0, -34]}>
                <strong>{i + 1}. {s.label}</strong>{s.kind === 'custom' ? ' · vlastní zastávka' : ''}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </Box>

      {/* Map controls: fullscreen, zoom, and reset-to-route (top-right). */}
      <Stack
        sx={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5,
          overflow: 'hidden', boxShadow: 2,
          '& > button': {
            width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer',
            border: 'none', bgcolor: 'transparent', color: 'text.primary',
            borderBottom: 1, borderColor: 'divider',
            '&:last-of-type': { borderBottom: 'none' },
            '&:hover': { bgcolor: 'action.hover' },
            '& svg': { fontSize: 19 },
          },
        }}
      >
        {editable && (
          <MuiTooltip title={showAlts ? 'Skrýt alternativní trasy' : 'Alternativní trasy'} placement="left">
            <Box component="button" type="button" onClick={() => setShowAlts((v) => !v)} aria-label="Alternativní trasy" sx={{ color: showAlts ? 'warning.main' : undefined }}>
              <AltRouteIcon />
            </Box>
          </MuiTooltip>
        )}
        <MuiTooltip title={isFull ? 'Ukončit celou obrazovku' : 'Celá obrazovka'} placement="left">
          <Box component="button" type="button" onClick={toggleFull} aria-label="Celá obrazovka">
            {isFull ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </Box>
        </MuiTooltip>
        <MuiTooltip title="Přiblížit" placement="left">
          <Box component="button" type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Přiblížit">
            <AddIcon />
          </Box>
        </MuiTooltip>
        <MuiTooltip title="Oddálit" placement="left">
          <Box component="button" type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Oddálit">
            <RemoveIcon />
          </Box>
        </MuiTooltip>
        <MuiTooltip title="Zpět na trasu" placement="left">
          <Box component="button" type="button" onClick={fitRoute} aria-label="Zpět na trasu">
            <CenterFocusStrongIcon />
          </Box>
        </MuiTooltip>
      </Stack>

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
