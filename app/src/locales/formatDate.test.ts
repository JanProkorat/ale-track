import { it, vi, expect, describe } from 'vitest';

import i18n from './i18n';
import { formatDate } from './formatDate';

// ------------------------------------
// Mocks
// ------------------------------------
vi.mock('./i18n', () => ({
    default: { language: 'en' },
}));

// ------------------------------------
// Tests
// ------------------------------------
describe('formatDate', () => {
    const testDate = new Date(2025, 0, 15); // January 15, 2025

    it('formats a date with default format (PPP)', () => {
        const result = formatDate(testDate);

        // English locale uses "January 15th, 2025" format for PPP
        expect(result).toContain('January');
        expect(result).toContain('15');
        expect(result).toContain('2025');
    });

    it('formats a date with custom format string', () => {
        const result = formatDate(testDate, 'yyyy-MM-dd');

        expect(result).toBe('2025-01-15');
    });

    it('uses Czech locale when i18n language is cs', () => {
        vi.mocked(i18n).language = 'cs';

        const result = formatDate(testDate, 'LLLL');

        // Czech for January = "leden"
        expect(result).toBe('leden');

        // Reset
        vi.mocked(i18n).language = 'en';
    });

    it('uses German locale when i18n language is de', () => {
        vi.mocked(i18n).language = 'de';

        const result = formatDate(testDate, 'LLLL');

        // German for January = "Januar"
        expect(result).toBe('Januar');

        // Reset
        vi.mocked(i18n).language = 'en';
    });

    it('falls back to English locale for unknown languages', () => {
        vi.mocked(i18n).language = 'xx';

        const result = formatDate(testDate, 'yyyy-MM-dd');

        expect(result).toBe('2025-01-15');

        // Reset
        vi.mocked(i18n).language = 'en';
    });

    it('formats date with time format', () => {
        const dateWithTime = new Date(2025, 5, 20, 14, 30);

        const result = formatDate(dateWithTime, 'HH:mm');

        expect(result).toBe('14:30');
    });
});
