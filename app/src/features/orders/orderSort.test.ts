import { describe, expect, it } from 'vitest';
import { sortOrdersNewestFirst } from './orderSort';

const row = (id: string, createdDate?: string) => ({ id, createdDate: createdDate ? new Date(createdDate) : undefined });

describe('sortOrdersNewestFirst', () => {
  it('puts the most recently created order first', () => {
    const rows = [row('a', '2026-01-02'), row('b', '2026-03-10'), row('c', '2026-02-01')];
    expect(sortOrdersNewestFirst(rows).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts rows without a creation date last', () => {
    const rows = [row('none'), row('older', '2026-01-02'), row('newer', '2026-05-05')];
    expect(sortOrdersNewestFirst(rows).map((r) => r.id)).toEqual(['newer', 'older', 'none']);
  });

  it('does not mutate the input array', () => {
    const rows = [row('a', '2026-01-02'), row('b', '2026-03-10')];
    sortOrdersNewestFirst(rows);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
