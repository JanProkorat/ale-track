import 'leaflet/dist/leaflet.css';

import type { LatLngExpression } from 'leaflet';

import { Marker, TileLayer, MapContainer } from 'react-leaflet';

import ChangeView from './change-view';
import RecenterButton from './recenter-button';
import { InvalidateSize } from './invalidate-size';
import { FullscreenControl } from './fullscreen-control';

type MapViewProps = {
     lat: number;
     lng: number;
     onFullscreen?: () => void;
     isFullscreen: boolean;
};

export function MapView({ lat, lng, onFullscreen, isFullscreen }: MapViewProps) {
     const position: LatLngExpression = [lat, lng];

     return (
          <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
               <ChangeView center={position} />
               <InvalidateSize active={isFullscreen} />
               <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution="© OpenStreetMap © CARTO"
               />

               <Marker position={[lat, lng]} />
               <RecenterButton position={position} />
               {onFullscreen && <FullscreenControl onClick={() => onFullscreen()} />}
          </MapContainer>
     );
}
