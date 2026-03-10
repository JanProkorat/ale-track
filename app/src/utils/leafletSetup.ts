import 'leaflet/dist/leaflet.css';

import L from 'leaflet';

// Fix Leaflet's default marker icons which break under Vite bundling.
// The CSS references are rewritten but the JS icon paths are not,
// so we override them with properly resolved asset URLs.
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
     iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
     iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
     shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});
