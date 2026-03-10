import { fetchRouteGeometry } from './routeService';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function osrmResponse(coordinates: [number, number][]) {
     return {
          ok: true,
          json: () =>
               Promise.resolve({
                    code: 'Ok',
                    routes: [{ geometry: { coordinates } }],
               }),
     };
}

describe('fetchRouteGeometry', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('returns empty array for fewer than 2 points', async () => {
          const result = await fetchRouteGeometry([{ lat: 50, lng: 14 }]);
          expect(result).toEqual([]);
          expect(mockFetch).not.toHaveBeenCalled();
     });

     it('returns empty array for empty array', async () => {
          const result = await fetchRouteGeometry([]);
          expect(result).toEqual([]);
          expect(mockFetch).not.toHaveBeenCalled();
     });

     it('constructs correct OSRM URL with coords in lng,lat format joined by ;', async () => {
          mockFetch.mockResolvedValue(osrmResponse([[14, 50], [15, 51]]));

          await fetchRouteGeometry([
               { lat: 50, lng: 14 },
               { lat: 51, lng: 15 },
          ]);

          expect(mockFetch).toHaveBeenCalledWith(
               'https://router.project-osrm.org/route/v1/driving/14,50;15,51?overview=full&geometries=geojson',
          );
     });

     it('transforms coordinates from [lng, lat] to [lat, lng] on success', async () => {
          mockFetch.mockResolvedValue(
               osrmResponse([
                    [14.42, 50.08],
                    [14.5, 50.1],
                    [15.0, 51.0],
               ]),
          );

          const result = await fetchRouteGeometry([
               { lat: 50, lng: 14 },
               { lat: 51, lng: 15 },
          ]);

          expect(result).toEqual([
               [50.08, 14.42],
               [50.1, 14.5],
               [51.0, 15.0],
          ]);
     });

     it('falls back to straight lines when code is not Ok', async () => {
          mockFetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve({ code: 'NoRoute', routes: [] }),
          });

          const points = [
               { lat: 50, lng: 14 },
               { lat: 51, lng: 15 },
          ];
          const result = await fetchRouteGeometry(points);

          expect(result).toEqual([
               [50, 14],
               [51, 15],
          ]);
     });

     it('falls back to straight lines when routes array is missing', async () => {
          mockFetch.mockResolvedValue({
               ok: true,
               json: () => Promise.resolve({ code: 'Ok' }),
          });

          const points = [
               { lat: 50, lng: 14 },
               { lat: 51, lng: 15 },
          ];
          const result = await fetchRouteGeometry(points);

          expect(result).toEqual([
               [50, 14],
               [51, 15],
          ]);
     });

     it('falls back to straight lines on network error', async () => {
          mockFetch.mockRejectedValue(new Error('Network error'));

          const points = [
               { lat: 50, lng: 14 },
               { lat: 51, lng: 15 },
          ];
          const result = await fetchRouteGeometry(points);

          expect(result).toEqual([
               [50, 14],
               [51, 15],
          ]);
     });
});
