import type { AddressDto } from "src/api/Client";

import { addressToString } from "src/utils/map-address-to-string";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export class GeoLocationProvider {
  async geocode(address: AddressDto): Promise<Coordinates | null> {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(addressToString(address))}` +
      `&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        // Nominatim to oficiálně vyžaduje
        'User-Agent': 'AleTrack/1.0 (prokoratJ@gmail.com)',
      },
    });

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    if (!data.length) {
      return null;
    }

    return {
      latitude: Number(data[0].lat),
      longitude: Number(data[0].lon),
    };
  }
}