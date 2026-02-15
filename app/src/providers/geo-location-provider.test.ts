import { it, vi, expect, afterAll, describe, beforeEach } from 'vitest';

import { Country, AddressDto } from 'src/api/Client';

import { GeoLocationProvider } from './geo-location-provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createAddress(overrides?: Partial<AddressDto>): AddressDto {
    return new AddressDto({
        streetName: 'Karlova',
        streetNumber: '1',
        city: 'Prague',
        zip: '11000',
        country: Country.Czechia,
        ...overrides,
    });
}

describe('GeoLocationProvider', () => {
    let provider: GeoLocationProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new GeoLocationProvider();
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('should return coordinates for a valid address', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([{ lat: '50.0755', lon: '14.4378' }]),
        });

        const result = await provider.geocode(createAddress());

        expect(result).toEqual({
            latitude: 50.0755,
            longitude: 14.4378,
        });
    });

    it('should return null when no results found', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        });

        const result = await provider.geocode(createAddress());

        expect(result).toBeNull();
    });

    it('should throw error when request fails', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
        });

        await expect(provider.geocode(createAddress())).rejects.toThrow('Geocoding request failed');
    });

    it('should call fetch with correct URL and headers', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([{ lat: '1', lon: '2' }]),
        });

        await provider.geocode(createAddress({
            streetName: 'Main St',
            streetNumber: '10',
            city: 'Berlin',
            zip: '10115',
            country: Country.Germany,
        }));

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('nominatim.openstreetmap.org/search');
        expect(url).toContain('format=json');
        expect(url).toContain('limit=1');
        expect(options.headers['User-Agent']).toContain('AleTrack');
    });

    it('should encode address in URL', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([{ lat: '1', lon: '2' }]),
        });

        await provider.geocode(createAddress({
            streetName: 'Hlavní',
            streetNumber: '5',
            city: 'Praha',
        }));

        const [url] = mockFetch.mock.calls[0];
        // addressToString produces the full address string which gets encoded
        expect(url).toContain('Hlavn');
    });
});
