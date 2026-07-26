import { afterEach, describe, expect, it, vi } from 'vitest';
import { partsFromNominatim, searchAddresses } from 'src/lib/geo';
import { Country } from 'src/generated/api-client';

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('searchAddresses', () => {
  it('maps Nominatim hits to AddressHit[]', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify([
          { display_name: 'Liberec, Česko', lat: '50.7663', lon: '15.0543' },
          { display_name: 'Liberec III, Česko', lat: '50.75', lon: '15.06' },
        ]),
        { status: 200 },
      ),
    );

    const hits = await searchAddresses('Liberec');

    expect(hits).toEqual([
      { label: 'Liberec, Česko', lat: 50.7663, lng: 15.0543 },
      { label: 'Liberec III, Česko', lat: 50.75, lng: 15.06 },
    ]);
  });

  it('drops hits with non-finite coordinates', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify([
          { display_name: 'Good', lat: '50.1', lon: '15.1' },
          { display_name: 'Bad', lat: 'x', lon: '15.2' },
        ]),
        { status: 200 },
      ),
    );

    const hits = await searchAddresses('whatever');

    expect(hits).toEqual([{ label: 'Good', lat: 50.1, lng: 15.1 }]);
  });

  it('returns [] for a blank query without calling the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const hits = await searchAddresses('   ');

    expect(hits).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns [] on an empty result set', async () => {
    mockFetch(async () => new Response('[]', { status: 200 }));
    expect(await searchAddresses('nowhere')).toEqual([]);
  });

  it('returns [] on a non-OK response', async () => {
    mockFetch(async () => new Response('nope', { status: 500 }));
    expect(await searchAddresses('boom')).toEqual([]);
  });

  it('returns [] when fetch rejects', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    expect(await searchAddresses('offline')).toEqual([]);
  });

  it('requests limit=5 with the query', async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await searchAddresses('Praha 1');

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('limit=5');
    expect(url).toMatch(/[?&]q=Praha\+1/);
  });
});

describe('partsFromNominatim', () => {
  it('maps a Czech address', () => {
    expect(partsFromNominatim({
      road: 'Masarykova', house_number: '1347', city: 'Liberec', postcode: '460 01', country_code: 'cz',
    })).toEqual({
      streetName: 'Masarykova', streetNumber: '1347', city: 'Liberec', zip: '460 01', country: Country.Czechia,
    });
  });

  it('falls back through town and village for the city', () => {
    expect(partsFromNominatim({ town: 'Frýdlant' }).city).toBe('Frýdlant');
    expect(partsFromNominatim({ village: 'Vísky' }).city).toBe('Vísky');
  });

  it('maps a German address', () => {
    expect(partsFromNominatim({ country_code: 'de' }).country).toBe(Country.Germany);
  });

  it('defaults an unknown country to Czechia — the business only ships CZ and DE', () => {
    expect(partsFromNominatim({ country_code: 'pl' }).country).toBe(Country.Czechia);
    expect(partsFromNominatim({}).country).toBe(Country.Czechia);
  });

  it('omits parts Nominatim did not return rather than emitting empty strings', () => {
    expect(partsFromNominatim({ road: 'Vísky' })).toEqual({ streetName: 'Vísky', country: Country.Czechia });
  });
});
