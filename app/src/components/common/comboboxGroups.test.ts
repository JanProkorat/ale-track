import { describe, it, expect } from 'vitest';
import { buildGroupRows, GROUP_ROW_PREFIX } from './comboboxGroups';
import type { ComboOption } from './Combobox';

const opts: ComboOption[] = [
  { value: 'a', label: 'Adam', group: 'Žitavsko' },
  { value: 'b', label: 'Bára', group: 'Žitavsko' },
  { value: 'c', label: 'Cyril', group: 'Lipsko' },
];

describe('buildGroupRows', () => {
  it('puts a header in front of each group and keeps the given order', () => {
    const rows = buildGroupRows(opts, new Set(), false);
    expect(rows.map((r) => r.label)).toEqual(['Žitavsko', 'Adam', 'Bára', 'Lipsko', 'Cyril']);
    expect(rows.filter((r) => r.header).map((r) => r.count)).toEqual([2, 1]);
  });

  it('gives header rows a value that cannot collide with an option value', () => {
    const [header] = buildGroupRows(opts, new Set(), false);
    expect(header.value).toBe(`${GROUP_ROW_PREFIX}Žitavsko`);
    expect(opts.some((o) => o.value === header.value)).toBe(false);
  });

  it('drops the items of a collapsed group but keeps its header and count', () => {
    const rows = buildGroupRows(opts, new Set(['Žitavsko']), false);
    expect(rows.map((r) => r.label)).toEqual(['Žitavsko', 'Lipsko', 'Cyril']);
    expect(rows[0]).toMatchObject({ header: true, count: 2, collapsed: true });
  });

  it('ignores collapse while a search is running, so no match stays hidden', () => {
    const rows = buildGroupRows(opts, new Set(['Žitavsko']), true);
    expect(rows.map((r) => r.label)).toEqual(['Žitavsko', 'Adam', 'Bára', 'Lipsko', 'Cyril']);
    expect(rows[0].collapsed).toBe(false);
  });

  it('omits a group whose items were all filtered away', () => {
    const rows = buildGroupRows([opts[2]], new Set(), true);
    expect(rows.map((r) => r.label)).toEqual(['Lipsko', 'Cyril']);
  });

  it('emits ungrouped options as plain rows ahead of the first header', () => {
    const rows = buildGroupRows([{ value: 'x', label: 'Bez regionu' }, ...opts], new Set(), false);
    expect(rows.map((r) => r.label)).toEqual(['Bez regionu', 'Žitavsko', 'Adam', 'Bára', 'Lipsko', 'Cyril']);
    expect(rows[0].header).toBeUndefined();
  });

  it('returns nothing for an empty option list', () => {
    expect(buildGroupRows([], new Set(), false)).toEqual([]);
  });
});
