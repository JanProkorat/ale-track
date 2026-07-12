interface CompanyAddress {
     latitude: number;
     longitude: number;
}

let cached: CompanyAddress | null = null;

export function getCompanyAddress(): CompanyAddress {
     if (cached) return cached;

     const raw = import.meta.env.VITE_COMPANY_ADDRESS;
     if (!raw) throw new Error('VITE_COMPANY_ADDRESS is not defined');

     const parsed = JSON.parse(raw);
     if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number') {
          throw new Error('VITE_COMPANY_ADDRESS must contain latitude and longitude');
     }

     cached = { latitude: parsed.latitude, longitude: parsed.longitude };
     return cached;
}
