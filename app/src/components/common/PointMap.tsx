import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L, { type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Stack, Tooltip as MuiTooltip, Typography } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOnOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import FullscreenIcon from '@mui/icons-material/FullscreenOutlined';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExitOutlined';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrongOutlined';

// A colored pin drawn as an inline SVG divIcon — avoids Leaflet's default
// marker-image asset (which breaks under bundlers) and lets us tint per use.
function pinIcon(color: string): L.DivIcon {
  const svg = `
    <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="#fff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'point-map-pin',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
  });
}

/** A small OpenStreetMap map with a single colored marker at the given point,
 * plus the same control stack the route map uses: fullscreen, zoom and
 * refocus-on-the-point. Without coordinates it renders the prototype's dashed
 * "Bez GPS souřadnic" placeholder rather than collapsing to nothing — a card
 * that silently loses its map reads as a layout bug. */
export function PointMap({
  lat,
  lng,
  color = '#0E7C9B',
  height = 180,
  zoom = 14,
}: {
  lat?: number;
  lng?: number;
  color?: string;
  height?: number;
  zoom?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [isFull, setIsFull] = useState(false);

  // Track native fullscreen: re-measure so tiles fill the new size, and let the
  // wheel zoom only while fullscreen — inline it would swallow page scroll.
  useEffect(() => {
    const onChange = () => {
      const full = document.fullscreenElement === wrapRef.current;
      setIsFull(full);
      requestAnimationFrame(() => {
        mapRef.current?.invalidateSize();
        if (full) mapRef.current?.scrollWheelZoom.enable();
        else mapRef.current?.scrollWheelZoom.disable();
      });
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (lat == null || lng == null) {
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
          <LocationOnIcon sx={{ fontSize: 22, mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">Bez GPS souřadnic</Typography>
        </Box>
      </Box>
    );
  }

  const refocus = () => mapRef.current?.setView([lat, lng], zoom);
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
      <Box sx={{ height: isFull ? '100%' : height }}>
        <MapContainer
          ref={mapRef}
          center={[lat, lng]}
          zoom={zoom}
          zoomControl={false}
          scrollWheelZoom={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[lat, lng]} icon={pinIcon(color)} />
        </MapContainer>
      </Box>

      {/* Map controls: fullscreen, zoom, and refocus-on-the-point (top-right) —
          same visual language as RouteMap's stack. */}
      <Stack
        sx={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5,
          overflow: 'hidden', boxShadow: 2,
          '& > button': {
            width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer',
            border: 'none', bgcolor: 'transparent', color: 'text.primary',
            borderBottom: 1, borderColor: 'divider',
            '&:last-of-type': { borderBottom: 'none' },
            '&:hover': { bgcolor: 'action.hover' },
            '& svg': { fontSize: 17 },
          },
        }}
      >
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
        <MuiTooltip title="Zpět na bod" placement="left">
          <Box component="button" type="button" onClick={refocus} aria-label="Zpět na bod">
            <CenterFocusStrongIcon />
          </Box>
        </MuiTooltip>
      </Stack>
    </Box>
  );
}
