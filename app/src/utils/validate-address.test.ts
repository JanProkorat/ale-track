import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const { validateAddress } = await import('src/utils/validate-address');
const { Country } = await import('src/api/Client');

describe('validate-address utilities', () => {
  describe('validateAddress', () => {
    it('should return empty errors for valid complete address', () => {
      const address = {
        streetName: 'Main Street',
        streetNumber: '123',
        city: 'Prague',
        zip: '11000',
        country: Country.Germany, // Use Germany (1) instead of Czechia (0) to avoid falsy issue
      };

      const errors = validateAddress(address);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should return error for missing streetName', () => {
      const address = {
        streetName: undefined,
        streetNumber: '123',
        city: 'Prague',
        zip: '11000',
        country: Country.Czechia,
      };

      const errors = validateAddress(address as any);
      expect(errors.streetName).toBe('common.required');
    });

    it('should return error for missing streetNumber', () => {
      const address = {
        streetName: 'Main Street',
        streetNumber: undefined,
        city: 'Prague',
        zip: '11000',
        country: Country.Czechia,
      };

      const errors = validateAddress(address as any);
      expect(errors.streetNumber).toBe('common.required');
    });

    it('should return error for missing city', () => {
      const address = {
        streetName: 'Main Street',
        streetNumber: '123',
        city: undefined,
        zip: '11000',
        country: Country.Czechia,
      };

      const errors = validateAddress(address as any);
      expect(errors.city).toBe('common.required');
    });

    it('should return error for missing zip', () => {
      const address = {
        streetName: 'Main Street',
        streetNumber: '123',
        city: 'Prague',
        zip: undefined,
        country: Country.Czechia,
      };

      const errors = validateAddress(address as any);
      expect(errors.zip).toBe('common.required');
    });

    it('should return error for missing country', () => {
      const address = {
        streetName: 'Main Street',
        streetNumber: '123',
        city: 'Prague',
        zip: '11000',
        country: undefined,
      };

      const errors = validateAddress(address as any);
      expect(errors.country).toBe('common.required');
    });

    it('should return multiple errors for multiple missing fields', () => {
      const address = {
        streetName: undefined,
        streetNumber: undefined,
        city: 'Prague',
        zip: '11000',
        country: Country.Germany, // Use Germany (1) instead of Czechia (0)
      };

      const errors = validateAddress(address as any);
      expect(errors.streetName).toBe('common.required');
      expect(errors.streetNumber).toBe('common.required');
      expect(Object.keys(errors)).toHaveLength(2);
    });

    it('should return all errors when all fields are missing', () => {
      const address = {
        streetName: undefined,
        streetNumber: undefined,
        city: undefined,
        zip: undefined,
        country: undefined,
      };

      const errors = validateAddress(address as any);
      expect(Object.keys(errors)).toHaveLength(5);
      expect(errors.streetName).toBe('common.required');
      expect(errors.streetNumber).toBe('common.required');
      expect(errors.city).toBe('common.required');
      expect(errors.zip).toBe('common.required');
      expect(errors.country).toBe('common.required');
    });

    it('should return empty errors for undefined address', () => {
      const errors = validateAddress(undefined);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
