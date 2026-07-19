// Small geo helpers shared by the shipment route map and the editor's
// nearest-neighbour route optimizer. Kept out of RouteMap.tsx so that
// component file only exports the component (react-refresh/only-export-components).

/** The company depot in Žitava — every route starts and (visually) loops back
 * here, matching the prototype's `DEPOT` constant. */
export const DEPOT = { lat: 50.897, lng: 14.807, name: 'Sklad Žitava' };

/** Great-circle distance in km. */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const d2r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d2r;
  const dLng = (b.lng - a.lng) * d2r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d2r) * Math.cos(b.lat * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
