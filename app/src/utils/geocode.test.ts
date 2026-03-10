const mockAddress = {
     streetName: 'Main Street',
     streetNumber: '123',
     city: 'Prague',
     zip: '11000',
     country: 'CZ',
};

const mockFetch = vi.fn();

beforeEach(() => {
     vi.useFakeTimers();
     vi.resetModules();
     globalThis.fetch = mockFetch;
     mockFetch.mockReset();
});

afterEach(() => {
     vi.useRealTimers();
});

async function callGeocodeAddress(address: typeof mockAddress) {
     const { geocodeAddress } = await import('src/utils/geocode');
     // Start the call - it may await a setTimeout due to rate limiting
     const promise = geocodeAddress(address);
     // Advance timers to resolve any rate-limiting delay
     await vi.advanceTimersByTimeAsync(1500);
     return promise;
}

describe('geocodeAddress', () => {
     it('returns geocoding result on valid response', async () => {
          mockFetch.mockResolvedValueOnce({
               json: () => Promise.resolve([{ lat: '50.0755', lon: '14.4378' }]),
          });

          const result = await callGeocodeAddress(mockAddress);

          expect(result).toEqual({ latitude: 50.0755, longitude: 14.4378 });
     });

     it('returns null on empty response array', async () => {
          mockFetch.mockResolvedValueOnce({
               json: () => Promise.resolve([]),
          });

          const result = await callGeocodeAddress(mockAddress);

          expect(result).toBeNull();
     });

     it('returns null on non-array response', async () => {
          mockFetch.mockResolvedValueOnce({
               json: () => Promise.resolve({ error: 'not found' }),
          });

          const result = await callGeocodeAddress(mockAddress);

          expect(result).toBeNull();
     });

     it('returns null on NaN coordinates', async () => {
          mockFetch.mockResolvedValueOnce({
               json: () => Promise.resolve([{ lat: 'invalid', lon: 'invalid' }]),
          });

          const result = await callGeocodeAddress(mockAddress);

          expect(result).toBeNull();
     });

     it('returns null on fetch error', async () => {
          mockFetch.mockRejectedValueOnce(new Error('Network error'));

          const result = await callGeocodeAddress(mockAddress);

          expect(result).toBeNull();
     });

     it('constructs correct URL with address parts', async () => {
          mockFetch.mockResolvedValueOnce({
               json: () => Promise.resolve([{ lat: '50.0755', lon: '14.4378' }]),
          });

          await callGeocodeAddress(mockAddress);

          expect(mockFetch).toHaveBeenCalledTimes(1);
          const calledUrl = mockFetch.mock.calls[0][0] as string;

          expect(calledUrl).toContain('https://nominatim.openstreetmap.org/search?');
          expect(calledUrl).toContain('street=123+Main+Street');
          expect(calledUrl).toContain('city=Prague');
          expect(calledUrl).toContain('postalcode=11000');
          expect(calledUrl).toContain('country=CZ');
          expect(calledUrl).toContain('format=json');
          expect(calledUrl).toContain('limit=1');
     });

     it('sets User-Agent header', async () => {
          mockFetch.mockResolvedValueOnce({
               json: () => Promise.resolve([{ lat: '50.0755', lon: '14.4378' }]),
          });

          await callGeocodeAddress(mockAddress);

          expect(mockFetch).toHaveBeenCalledTimes(1);
          const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;

          expect(calledOptions.headers).toEqual({ 'User-Agent': 'AleTrackApp/1.0' });
     });
});
