import type { LatLngExpression } from "leaflet";

import { useMap } from "react-leaflet";

import NearMeIcon from '@mui/icons-material/NearMe';

type RecenterButtonProps = {
  position: LatLngExpression;
};

export function RecenterButton({ position }: RecenterButtonProps) {
  const map = useMap();

  const recenter = () => {
    map.flyTo(position, map.getZoom(), {
      animate: true,
      duration: 0.5,
    });
  };

  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={recenter}
          style={{
            background: "white",
            border: "none",
            padding: "2px 2px 0px 2px",
            cursor: "pointer",
            color: "black",
          }}
          title="Zpět na bod"
        >
          <NearMeIcon />
        </button>
      </div>
    </div>
  );
}

export default RecenterButton;