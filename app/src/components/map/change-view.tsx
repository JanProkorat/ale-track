import type { LatLngExpression } from 'leaflet';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

type ChangeViewProps = {
     center: LatLngExpression;
};

function ChangeView({ center }: ChangeViewProps) {
     const map = useMap();

     useEffect(() => {
          map.setView(center);
     }, [center, map]);

     return null;
}

export default ChangeView;
