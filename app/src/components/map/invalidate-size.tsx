import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

type InvalidateSizeProps = {
  active: boolean;
};

export function InvalidateSize({ active }: InvalidateSizeProps) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;

    const timeout = setTimeout(() => {
      map.invalidateSize();
      map.setView(map.getCenter());
    }, 300); // ⚠️ important delay to ensure map container has resized

    // eslint-disable-next-line consistent-return
    return () => clearTimeout(timeout);
  }, [active, map]);

  return null;
}