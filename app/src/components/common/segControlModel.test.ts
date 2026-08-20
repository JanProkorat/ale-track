import { describe, it, expect } from 'vitest';
import { mobileGrid } from './segControlModel';

const WRAPPING_COUNTS = [4, 5, 6, 7, 8, 9, 12];

describe('mobileGrid', () => {
  it('leaves three or fewer options ungridded so the track keeps hugging its content', () => {
    for (const count of [1, 2, 3]) {
      expect(mobileGrid(count)).toEqual({ columns: 0, lastSpansRow: false });
    }
  });

  it('never leaves an orphan on the last row', () => {
    // The whole point: free wrapping put 1 of 6 filters alone on row 2.
    for (const count of WRAPPING_COUNTS) {
      const { columns, lastSpansRow } = mobileGrid(count);
      const alone = count % columns === 1;
      expect(alone && !lastSpansRow, `${count} options in ${columns} columns orphans one`).toBe(false);
    }
  });

  it('prefers three across, dropping to two only when that fills the rows better', () => {
    expect(mobileGrid(6).columns).toBe(3); // exact fit
    expect(mobileGrid(5).columns).toBe(3); // one gap either way, fewer rows with 3
    expect(mobileGrid(9).columns).toBe(3);
    expect(mobileGrid(4).columns).toBe(2); // 3 across would leave two gaps
    expect(mobileGrid(8).columns).toBe(2);
  });

  it('spans the last option only when it would otherwise sit alone', () => {
    // 7 has no orphan-free uniform grid at 2 or 3 across, so it must span.
    expect(mobileGrid(7).lastSpansRow).toBe(true);
    for (const count of [4, 5, 6, 8, 9, 12]) {
      expect(mobileGrid(count).lastSpansRow, `${count} should not need a spanning row`).toBe(false);
    }
  });

  it('picks a column count that can hold more than one option', () => {
    for (const count of WRAPPING_COUNTS) {
      expect(mobileGrid(count).columns).toBeGreaterThan(1);
      expect(mobileGrid(count).columns).toBeLessThanOrEqual(3);
    }
  });
});
