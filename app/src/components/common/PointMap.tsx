import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';

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

/** A small OpenStreetMap map with a single colored marker at the given point.
 * Renders nothing when coordinates are missing. */
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
  if (lat == null || lng == null) return null;
  return (
    <Box sx={{ height, borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', '& .leaflet-container': { height: '100%', width: '100%' } }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={pinIcon(color)} />
      </MapContainer>
    </Box>
  );
}
