import { useState, useEffect } from 'react';
import { useMap, Marker, TileLayer, MapContainer } from 'react-leaflet';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

import FullscreenMapDialog from './FullscreenMapDialog';

// ---------------------------------------------------------------------------

interface MapPreviewProps {
     latitude: number;
     longitude: number;
     height?: number | string;
     zoom?: number;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
     const map = useMap();
     useEffect(() => {
          map.setView(center, zoom);
     }, [map, center, zoom]);
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

function MapContent({ center, zoom }: { center: [number, number]; zoom: number }) {
     return (
          <>
               <ChangeView center={center} zoom={zoom} />
               <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
               />
               <Marker position={center} />
          </>
     );
}

export default function MapPreview({ latitude, longitude, height = 200, zoom = 14 }: MapPreviewProps) {
     const [fullscreen, setFullscreen] = useState(false);
     const center: [number, number] = [latitude, longitude];

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
                    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                         <MapContent center={center} zoom={zoom} />
                    </MapContainer>
               </Box>

               <FullscreenMapDialog open={fullscreen} onClose={() => setFullscreen(false)}>
                    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                         <InvalidateSize />
                         <MapContent center={center} zoom={zoom} />
                    </MapContainer>
               </FullscreenMapDialog>
          </>
     );
}
