interface AddressInput {
     streetName: string;
     streetNumber: string;
     city: string;
     zip: string;
     country: string;
}

interface GeocodingResult {
     latitude: number;
     longitude: number;
}

let lastCallTime = 0;

export async function geocodeAddress(address: AddressInput): Promise<GeocodingResult | null> {
     const now = Date.now();
     const elapsed = now - lastCallTime;
     if (elapsed < 1000) {
          await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
     }
     lastCallTime = Date.now();

     const params = new URLSearchParams({
          street: `${address.streetNumber} ${address.streetName}`,
          city: address.city,
          postalcode: address.zip,
          country: address.country,
          format: 'json',
          limit: '1',
     });

     try {
          const response = await fetch(
               `https://nominatim.openstreetmap.org/search?${params.toString()}`,
               {
                    headers: { 'User-Agent': 'AleTrackApp/1.0' },
               },
          );

          const data = await response.json();
          if (!Array.isArray(data) || data.length === 0) return null;

          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (isNaN(lat) || isNaN(lon)) return null;

          return { latitude: lat, longitude: lon };
     } catch {
          return null;
     }
}
