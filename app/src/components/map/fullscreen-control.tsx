import { useMap } from "react-leaflet";

import FullscreenIcon from '@mui/icons-material/Fullscreen';

type FullscreenControlProps = {
  onClick: () => void;
};

export function FullscreenControl({ onClick }: FullscreenControlProps) {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={onClick}
          title="Zobrazit mapu přes celou obrazovku"
          style={{
            background: "white",
            border: "none",
            padding: "2px 2px 0px 2px",
            cursor: "pointer",
            color: "black",
          }}
        >
            <FullscreenIcon />
        </button>
      </div>
    </div>
  );
}