import { it, expect, describe } from 'vitest';

import { fNumber, fPercent, fCurrency, fShortenNumber } from 'src/utils/format-number';

describe('format-number utilities', () => {
  describe('fNumber', () => {
    it('should format positive numbers', () => {
      expect(fNumber(1234.56)).toBe('1,234.56');
      expect(fNumber(1000)).toBe('1,000');
    });

    it('should format negative numbers', () => {
      expect(fNumber(-1234.56)).toBe('-1,234.56');
    });

    it('should handle zero', () => {
      expect(fNumber(0)).toBe('0');
    });

    it('should handle null/undefined', () => {
      expect(fNumber(null)).toBe('');
      expect(fNumber(undefined)).toBe('');
    });

    it('should handle NaN', () => {
      expect(fNumber(NaN)).toBe('');
    });

    it('should format string numbers', () => {
      expect(fNumber('1234.56')).toBe('1,234.56');
    });
  });

  describe('fCurrency', () => {
    it('should format currency with dollar sign', () => {
      const result = fCurrency(1234.56);
      expect(result).toContain('1,234.56');
      expect(result).toContain('$');
    });

    it('should format zero currency', () => {
      const result = fCurrency(0);
      expect(result).toContain('0');
      expect(result).toContain('$');
    });

    it('should handle negative currency', () => {
      const result = fCurrency(-1234.56);
      expect(result).toContain('1,234.56');
      expect(result).toContain('$');
      expect(result).toContain('-');
    });

    it('should handle null/undefined', () => {
      expect(fCurrency(null)).toBe('');
      expect(fCurrency(undefined)).toBe('');
    });

    it('should format string numbers as currency', () => {
      const result = fCurrency('1234.56');
      expect(result).toContain('1,234.56');
      expect(result).toContain('$');
    });

    it('should respect custom options', () => {
      const result = fCurrency(1234.567, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      expect(result).toContain('1,234.57');
    });
  });

  describe('fPercent', () => {
    it('should format positive percentages', () => {
      expect(fPercent(50)).toBe('50%');
      expect(fPercent(25.5)).toBe('25.5%');
    });

    it('should format negative percentages', () => {
      expect(fPercent(-25)).toBe('-25%');
    });

    it('should handle zero', () => {
      expect(fPercent(0)).toBe('0%');
    });

    it('should handle decimal values', () => {
      expect(fPercent(0.5)).toBe('0.5%');
    });

    it('should handle null/undefined', () => {
      expect(fPercent(null)).toBe('');
      expect(fPercent(undefined)).toBe('');
    });

    it('should format string numbers', () => {
      expect(fPercent('50')).toBe('50%');
    });

    it('should limit fraction digits', () => {
      expect(fPercent(33.333)).toBe('33.3%');
    });
  });

  describe('fShortenNumber', () => {
    it('should format numbers less than 1000', () => {
      expect(fShortenNumber(999)).toBe('999');
      expect(fShortenNumber(500)).toBe('500');
    });

    it('should format thousands with K', () => {
      expect(fShortenNumber(1500)).toBe('1.5k');
      expect(fShortenNumber(1000)).toBe('1k');
      expect(fShortenNumber(12345)).toBe('12.35k');
    });

    it('should format millions with M', () => {
      expect(fShortenNumber(1500000)).toBe('1.5m');
      expect(fShortenNumber(1000000)).toBe('1m');
    });

    it('should format billions with B', () => {
      expect(fShortenNumber(1500000000)).toBe('1.5b');
      expect(fShortenNumber(1000000000)).toBe('1b');
    });

    it('should handle zero', () => {
      expect(fShortenNumber(0)).toBe('0');
    });

    it('should handle negative numbers', () => {
      expect(fShortenNumber(-1500)).toBe('-1.5k');
    });

    it('should handle null/undefined', () => {
      expect(fShortenNumber(null)).toBe('');
      expect(fShortenNumber(undefined)).toBe('');
    });

    it('should format string numbers', () => {
      expect(fShortenNumber('1500')).toBe('1.5k');
    });
  });
});
