beforeEach(() => {
     vi.resetModules();
     vi.unstubAllEnvs();
});

afterEach(() => {
     vi.unstubAllEnvs();
});

describe('getCompanyAddress', () => {
     it('returns valid coordinates from env var', async () => {
          vi.stubEnv('VITE_COMPANY_ADDRESS', JSON.stringify({ latitude: 50.0755, longitude: 14.4378 }));

          const { getCompanyAddress } = await import('src/utils/companyAddress');
          const result = getCompanyAddress();

          expect(result).toEqual({ latitude: 50.0755, longitude: 14.4378 });
     });

     it('throws when env var is not defined', async () => {
          vi.stubEnv('VITE_COMPANY_ADDRESS', '');

          const { getCompanyAddress } = await import('src/utils/companyAddress');

          expect(() => getCompanyAddress()).toThrow('VITE_COMPANY_ADDRESS is not defined');
     });

     it('throws when env var has no latitude/longitude', async () => {
          vi.stubEnv('VITE_COMPANY_ADDRESS', JSON.stringify({ lat: 50, lon: 14 }));

          const { getCompanyAddress } = await import('src/utils/companyAddress');

          expect(() => getCompanyAddress()).toThrow('VITE_COMPANY_ADDRESS must contain latitude and longitude');
     });

     it('throws on invalid JSON', async () => {
          vi.stubEnv('VITE_COMPANY_ADDRESS', 'not-json');

          const { getCompanyAddress } = await import('src/utils/companyAddress');

          expect(() => getCompanyAddress()).toThrow();
     });

     it('caches the result (second call returns same object reference)', async () => {
          vi.stubEnv('VITE_COMPANY_ADDRESS', JSON.stringify({ latitude: 50.0755, longitude: 14.4378 }));

          const { getCompanyAddress } = await import('src/utils/companyAddress');
          const first = getCompanyAddress();
          const second = getCompanyAddress();

          expect(first).toBe(second);
     });
});
