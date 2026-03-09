interface RoutePoint {
     lat: number;
     lng: number;
}

export async function fetchRouteGeometry(points: RoutePoint[]): Promise<[number, number][]> {
     if (points.length < 2) return [];

     const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');

     try {
          const response = await fetch(
               `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
          );

          const data = await response.json();
          if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
               return straightLines(points);
          }

          return data.routes[0].geometry.coordinates.map(
               ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
          );
     } catch {
          return straightLines(points);
     }
}

function straightLines(points: RoutePoint[]): [number, number][] {
     return points.map((p) => [p.lat, p.lng] as [number, number]);
}
