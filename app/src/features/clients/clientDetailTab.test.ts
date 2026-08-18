// The `?tab=` value reaches the detail from links, bookmarks and hand-typed
// URLs, so anything that is not one of the four tabs has to land on Info
// rather than leaving MUI Tabs pointed at a value it has no Tab for.

import { describe, expect, it } from 'vitest';
import { clientDetailTab } from './clientDetailTab';

describe('clientDetailTab', () => {
  it('keeps every tab the detail actually has', () => {
    expect(clientDetailTab('info')).toBe('info');
    expect(clientDetailTab('orders')).toBe('orders');
    expect(clientDetailTab('prices')).toBe('prices');
    expect(clientDetailTab('reminders')).toBe('reminders');
    expect(clientDetailTab('notes')).toBe('notes');
  });

  it('narrows the prices tab and still falls back for an unknown value', () => {
    expect(clientDetailTab('prices')).toBe('prices');
    expect(clientDetailTab('nonsense')).toBe('info');
    expect(clientDetailTab(null)).toBe('info');
  });

  it.each([
    ['a missing param', null],
    ['an undefined param', undefined],
    ['an empty value', ''],
    ['an unknown tab', 'invoices'],
    ['a case mismatch', 'Orders'],
  ])('falls back to Info for %s', (_label, value) => {
    expect(clientDetailTab(value)).toBe('info');
  });
});
