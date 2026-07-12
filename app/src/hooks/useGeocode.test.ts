import { act, renderHook } from 'src/test/test-utils';

import { useGeocode } from './useGeocode';

vi.mock('src/utils/geocode', () => ({
     geocodeAddress: vi.fn(),
}));

const mockAddress = {
     streetName: 'Main Street',
     streetNumber: '42',
     city: 'Prague',
     zip: '11000',
     country: 'CZ',
};

describe('useGeocode', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('initial isGeocoding is false', () => {
          const { result } = renderHook(() => useGeocode());
          expect(result.current.isGeocoding).toBe(false);
     });

     it('geocode calls geocodeAddress with the provided address', async () => {
          const { geocodeAddress } = await import('src/utils/geocode');
          vi.mocked(geocodeAddress).mockResolvedValue({ lat: 50.08, lng: 14.42 });

          const { result } = renderHook(() => useGeocode());

          await act(async () => {
               await result.current.geocode(mockAddress);
          });

          expect(geocodeAddress).toHaveBeenCalledWith(mockAddress);
     });

     it('returns the result from geocodeAddress', async () => {
          const { geocodeAddress } = await import('src/utils/geocode');
          const expected = { lat: 50.08, lng: 14.42 };
          vi.mocked(geocodeAddress).mockResolvedValue(expected);

          const { result } = renderHook(() => useGeocode());

          let returned: unknown;
          await act(async () => {
               returned = await result.current.geocode(mockAddress);
          });

          expect(returned).toEqual(expected);
     });

     it('isGeocoding is false after geocode completes', async () => {
          const { geocodeAddress } = await import('src/utils/geocode');
          vi.mocked(geocodeAddress).mockResolvedValue({ lat: 50.08, lng: 14.42 });

          const { result } = renderHook(() => useGeocode());

          await act(async () => {
               await result.current.geocode(mockAddress);
          });

          expect(result.current.isGeocoding).toBe(false);
     });
});
