import { it, expect, describe } from 'vitest';

import { emptyRows, visuallyHidden } from './utils';

describe('emptyRows', () => {
    it('should return 0 for page 0', () => {
        expect(emptyRows(0, 5, 12)).toBe(0);
    });

    it('should return remaining rows for partial last page', () => {
        // page=1, rowsPerPage=5, total=8 → (1+1)*5 - 8 = 2
        expect(emptyRows(1, 5, 8)).toBe(2);
    });

    it('should return 0 when last page is full', () => {
        // page=1, rowsPerPage=5, total=10 → (1+1)*5 - 10 = 0
        expect(emptyRows(1, 5, 10)).toBe(0);
    });

    it('should return 0 when there are more items than slots', () => {
        // page=1, rowsPerPage=5, total=20 → max(0, 10-20) = 0
        expect(emptyRows(1, 5, 20)).toBe(0);
    });

    it('should handle rowsPerPage of 10', () => {
        // page=2, rowsPerPage=10, total=25 → (2+1)*10 - 25 = 5
        expect(emptyRows(2, 10, 25)).toBe(5);
    });
});

describe('visuallyHidden', () => {
    it('should have correct CSS properties for screen reader only content', () => {
        expect(visuallyHidden.border).toBe(0);
        expect(visuallyHidden.margin).toBe(-1);
        expect(visuallyHidden.padding).toBe(0);
        expect(visuallyHidden.width).toBe('1px');
        expect(visuallyHidden.height).toBe('1px');
        expect(visuallyHidden.overflow).toBe('hidden');
        expect(visuallyHidden.position).toBe('absolute');
        expect(visuallyHidden.whiteSpace).toBe('nowrap');
        expect(visuallyHidden.clip).toBe('rect(0 0 0 0)');
    });
});
