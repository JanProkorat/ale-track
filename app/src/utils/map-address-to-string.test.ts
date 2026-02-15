import { it, vi, expect, describe } from 'vitest';

import { AddressDto } from 'src/api/Client';

// Mock the i18next module
vi.mock('i18next', () => ({
  t: (key: string) => key, // Return the key as-is for testing
}));

// Mock the API Client module
vi.mock('src/api/Client', () => ({
  Country: {
    Czechia: 0,
    Germany: 1,
  },
}));

// Import after mocks are set up
const { addressToString } = await import('src/utils/map-address-to-string');
const { Country } = await import('src/api/Client');

describe('map-address-to-string utilities', () => {
  describe('addressToString', () => {
    it('should format complete address', () => {
      const address = {
        streetName: 'Main Street',
        streetNumber: '123',
        city: 'Prague',
        zip: '11000',
        country: Country.Czechia,
      };

      const result = addressToString(address);
      expect(result).toBe('Main Street 123, 11000 Prague, Czech Republic');
    });

    it('should handle missing street number', () => {
      const address = new AddressDto({
        streetName: 'Main Street',
        streetNumber: "",
        city: 'Prague',
        zip: '11000',
        country: Country.Czechia,
      });

      const result = addressToString(address);
      expect(result).toBe('Main Street, 11000 Prague, Czech Republic');
    });

    it('should handle missing street name', () => {
      const address = new AddressDto({
        streetName: "",
        streetNumber: '123',
        city: 'Prague',
        zip: '11000',
        country: Country.Czechia,
      });

      const result = addressToString(address);
      expect(result).toBe('123, 11000 Prague, Czech Republic');
    });

    it('should handle missing zip', () => {
      const address = new AddressDto({
        streetName: 'Main Street',
        streetNumber: '123',
        city: 'Prague',
        zip: "",
        country: Country.Czechia,
      });

      const result = addressToString(address);
      expect(result).toBe('Main Street 123, Prague, Czech Republic');
    });

    it('should handle missing city', () => {
      const address = new AddressDto({
        streetName: 'Main Street',
        streetNumber: '123',
        city: "",
        zip: '11000',
        country: Country.Czechia,
      });

      const result = addressToString(address);
      expect(result).toBe('Main Street 123, 11000, Czech Republic');
    });

    it('should format German addresses', () => {
      const address = {
        streetName: 'Hauptstraße',
        streetNumber: '42',
        city: 'Berlin',
        zip: '10115',
        country: Country.Germany,
      };

      const result = addressToString(address);
      expect(result).toBe('Hauptstraße 42, 10115 Berlin, Germany');
    });

    it('should handle minimal address with only country', () => {
      const address = new AddressDto({
        streetName: "",
        streetNumber: "",
        city: "",
        zip: "",
        country: Country.Czechia,
      });

      const result = addressToString(address);
      expect(result).toBe('Czech Republic');
    });
  });
});
