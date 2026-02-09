import { it, vi, expect, describe } from 'vitest';

// Mock the API Client module
vi.mock('src/api/Client', () => ({
  DayOfWeek: {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  },
}));

// Import after mocks are set up
const { sortDaysOfWeek } = await import('src/utils/sort-daysof-week');
const { DayOfWeek } = await import('src/api/Client');

describe('sort-daysof-week utilities', () => {
  describe('sortDaysOfWeek', () => {
    it('should sort days starting from Monday', () => {
      const days = [DayOfWeek.Friday, DayOfWeek.Monday, DayOfWeek.Wednesday];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday]);
    });

    it('should sort with Sunday at the end', () => {
      const days = [DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Saturday];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([DayOfWeek.Monday, DayOfWeek.Saturday, DayOfWeek.Sunday]);
    });

    it('should handle already sorted days', () => {
      const days = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday]);
    });

    it('should handle reverse sorted days', () => {
      const days = [DayOfWeek.Sunday, DayOfWeek.Saturday, DayOfWeek.Friday];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday]);
    });

    it('should handle all days of the week', () => {
      const days = [
        DayOfWeek.Sunday,
        DayOfWeek.Wednesday,
        DayOfWeek.Friday,
        DayOfWeek.Monday,
        DayOfWeek.Thursday,
        DayOfWeek.Saturday,
        DayOfWeek.Tuesday,
      ];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([
        DayOfWeek.Monday,
        DayOfWeek.Tuesday,
        DayOfWeek.Wednesday,
        DayOfWeek.Thursday,
        DayOfWeek.Friday,
        DayOfWeek.Saturday,
        DayOfWeek.Sunday,
      ]);
    });

    it('should handle empty array', () => {
      const days: typeof DayOfWeek[] = [];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([]);
    });

    it('should handle single day', () => {
      const days = [DayOfWeek.Wednesday];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([DayOfWeek.Wednesday]);
    });

    it('should handle duplicate days', () => {
      const days = [DayOfWeek.Monday, DayOfWeek.Monday, DayOfWeek.Tuesday];
      const sorted = sortDaysOfWeek(days);

      expect(sorted).toEqual([DayOfWeek.Monday, DayOfWeek.Monday, DayOfWeek.Tuesday]);
    });

    it('should not mutate original array', () => {
      const days = [DayOfWeek.Friday, DayOfWeek.Monday, DayOfWeek.Wednesday];
      const original = [...days];
      sortDaysOfWeek(days);

      expect(days).toEqual(original);
    });
  });
});
