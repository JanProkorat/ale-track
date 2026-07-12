import L from 'leaflet';
import { useState, useEffect } from 'react';
import { Popup, Marker, useMap, Polyline, TileLayer, MapContainer } from 'react-leaflet';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

import { fetchRouteGeometry } from 'src/utils/routeService';

import FullscreenMapDialog from './FullscreenMapDialog';

// ---------------------------------------------------------------------------

export interface RoutePoint {
     lat: number;
     lng: number;
     label?: string;
     isDepot?: boolean;
}

interface RouteMapProps {
     points: RoutePoint[];
     height?: number | string;
}

const depotIcon = new L.Icon({
     iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
     shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
     iconSize: [25, 41],
     iconAnchor: [12, 41],
     popupAnchor: [1, -34],
     shadowSize: [41, 41],
});

function createNumberedIcon(num: number) {
     return L.divIcon({
          className: '',
          html: `<div style="
               background: #1976d2;
               color: white;
               border-radius: 50%;
               width: 28px;
               height: 28px;
               display: flex;
               align-items: center;
               justify-content: center;
               font-weight: bold;
               font-size: 14px;
               border: 2px solid white;
               box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${num}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
     });
}

function FitBounds({ points }: { points: RoutePoint[] }) {
     const map = useMap();
     useEffect(() => {
          if (points.length === 0) return;
          const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
          map.fitBounds(bounds, { padding: [40, 40] });
     }, [map, points]);
     return null;
}

function InvalidateSize() {
     const map = useMap();
     useEffect(() => {
          const timer = setTimeout(() => map.invalidateSize(), 100);
          return () => clearTimeout(timer);
     }, [map]);
     return null;
}

function MapContent({ points, routeLine }: { points: RoutePoint[]; routeLine: [number, number][] }) {
     let waypointNum = 0;
     return (
          <>
               <FitBounds points={points} />
               <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
               />
               {points.map((point, idx) => {
                    const icon = point.isDepot ? depotIcon : createNumberedIcon(++waypointNum);
                    return (
                         <Marker key={idx} position={[point.lat, point.lng]} icon={icon}>
                              {point.label && (
                                   <Popup>
                                        <Typography variant="body2">{point.label}</Typography>
                                   </Popup>
                              )}
                         </Marker>
                    );
               })}
               {routeLine.length > 1 && (
                    <Polyline positions={routeLine} color="#1976d2" weight={4} opacity={0.7} />
               )}
          </>
     );
}

export default function RouteMap({ points, height = 400 }: RouteMapProps) {
     const [routeLine, setRouteLine] = useState<[number, number][]>([]);
     const [fullscreen, setFullscreen] = useState(false);

     useEffect(() => {
          if (points.length < 2) {
               setRouteLine([]);
               return;
          }
          fetchRouteGeometry(points).then(setRouteLine);
     }, [points]);

     if (points.length === 0) return null;

     const center: [number, number] = [points[0].lat, points[0].lng];

     return (
          <>
               <Box sx={{ height, width: '100%', position: 'relative', '& .leaflet-container': { height: '100%', borderRadius: 1 } }}>
                    <IconButton
                         size="small"
                         onClick={() => setFullscreen(true)}
                         sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              zIndex: 1000,
                              bgcolor: 'background.paper',
                              boxShadow: 2,
                              '&:hover': { bgcolor: 'background.default' },
                         }}
                    >
                         <FullscreenIcon fontSize="small" />
                    </IconButton>
                    <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
                         <MapContent points={points} routeLine={routeLine} />
                    </MapContainer>
               </Box>

               <FullscreenMapDialog open={fullscreen} onClose={() => setFullscreen(false)}>
                    <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
                         <InvalidateSize />
                         <MapContent points={points} routeLine={routeLine} />
                    </MapContainer>
               </FullscreenMapDialog>
          </>
     );
}
