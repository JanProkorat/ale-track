import { it, expect, describe } from 'vitest';

import { fDate, fToNow, fDateTime } from 'src/utils/format-time';

describe('format-time utilities', () => {
  describe('fDateTime', () => {
    it('should format valid dates with default template', () => {
      const date = new Date('2024-04-17T12:00:00');
      const result = fDateTime(date);
      expect(result).toContain('17');
      expect(result).toContain('Apr');
      expect(result).toContain('2024');
    });

    it('should format with custom template', () => {
      const date = new Date('2024-04-17T12:00:00');
      const result = fDateTime(date, 'YYYY-MM-DD');
      expect(result).toBe('2024-04-17');
    });

    it('should handle string dates', () => {
      const result = fDateTime('2024-04-17T12:00:00');
      expect(result).toContain('17');
      expect(result).toContain('Apr');
      expect(result).toContain('2024');
    });

    it('should handle timestamp numbers', () => {
      const timestamp = new Date('2024-04-17T12:00:00').getTime();
      const result = fDateTime(timestamp);
      expect(result).toContain('17');
      expect(result).toContain('Apr');
      expect(result).toContain('2024');
    });

    it('should return "Invalid date" for null', () => {
      expect(fDateTime(null)).toBe('Invalid date');
    });

    it('should return "Invalid date" for undefined', () => {
      expect(fDateTime(undefined)).toBe('Invalid date');
    });

    it('should return "Invalid date" for invalid date string', () => {
      expect(fDateTime('invalid-date')).toBe('Invalid date');
    });
  });

  describe('fDate', () => {
    it('should format valid dates with default template', () => {
      const date = new Date('2024-04-17T12:00:00');
      const result = fDate(date);
      expect(result).toContain('17');
      expect(result).toContain('Apr');
      expect(result).toContain('2024');
      expect(result).not.toContain('12:00');
    });

    it('should format with custom template', () => {
      const date = new Date('2024-04-17T12:00:00');
      const result = fDate(date, 'DD/MM/YYYY');
      expect(result).toBe('17/04/2024');
    });

    it('should handle string dates', () => {
      const result = fDate('2024-04-17');
      expect(result).toContain('17');
      expect(result).toContain('Apr');
      expect(result).toContain('2024');
    });

    it('should handle timestamp numbers', () => {
      const timestamp = new Date('2024-04-17T12:00:00').getTime();
      const result = fDate(timestamp);
      expect(result).toContain('17');
      expect(result).toContain('Apr');
      expect(result).toContain('2024');
    });

    it('should return "Invalid date" for null', () => {
      expect(fDate(null)).toBe('Invalid date');
    });

    it('should return "Invalid date" for undefined', () => {
      expect(fDate(undefined)).toBe('Invalid date');
    });

    it('should return "Invalid date" for invalid date string', () => {
      expect(fDate('invalid-date')).toBe('Invalid date');
    });
  });

  describe('fToNow', () => {
    it('should return relative time for recent dates', () => {
      const now = new Date();
      const result = fToNow(now);
      expect(result).toContain('second');
    });

    it('should return relative time for past dates', () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);
      const result = fToNow(pastDate);
      expect(result).toMatch(/hour/);
    });

    it('should handle string dates', () => {
      const result = fToNow(new Date().toISOString());
      expect(result).toBeTruthy();
    });

    it('should return "Invalid date" for null', () => {
      expect(fToNow(null)).toBe('Invalid date');
    });

    it('should return "Invalid date" for undefined', () => {
      expect(fToNow(undefined)).toBe('Invalid date');
    });

    it('should return "Invalid date" for invalid date string', () => {
      expect(fToNow('invalid-date')).toBe('Invalid date');
    });
  });
});
