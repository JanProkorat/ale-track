import { describe, expect, it } from 'vitest';
import { detailBackState } from './backNav';

describe('detailBackState', () => {
  it('reads a back target attached by the calling screen', () => {
    expect(detailBackState({ backTo: '/shipments/ship-1', backLabel: 'Zpět na vývoz' }))
      .toEqual({ backTo: '/shipments/ship-1', backLabel: 'Zpět na vývoz' });
  });

  // Location state is whatever the browser kept — a bookmarked deep link, a
  // refresh, or an entry written by an older build. Anything but the full shape
  // has to fall back to the screen's own list rather than navigate to
  // `/undefined` or render an empty back tooltip.
  it.each([
    ['no state at all', null],
    ['undefined', undefined],
    ['an unrelated object', { from: '/shipments/ship-1' }],
    ['a missing label', { backTo: '/shipments/ship-1' }],
    ['a missing target', { backLabel: 'Zpět na vývoz' }],
    ['a non-string target', { backTo: 42, backLabel: 'Zpět na vývoz' }],
    ['a bare string', 'shipments'],
  ])('ignores %s', (_case, state) => {
    expect(detailBackState(state)).toBeUndefined();
  });
});
