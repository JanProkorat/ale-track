import { describe, expect, it } from 'vitest';
import { ALL_INVOICES, UNLOAD_VIEW, defaultLoadingView } from './loadingView';

describe('defaultLoadingView', () => {
  it.each(['Created', 'Loaded'])('opens the loading list while the van is being packed (%s)', (state) => {
    expect(defaultLoadingView(state)).toBe(ALL_INVOICES);
  });

  // Na cestě: the loading list is history and the stop-by-stop unload order is what is being
  // worked through. Doručeno keeps it, so a run arriving under the office's eyes does not snap
  // back to a list nobody needs any more.
  it.each(['InTransit', 'Delivered'])('opens the unload view once the van is out (%s)', (state) => {
    expect(defaultLoadingView(state)).toBe(UNLOAD_VIEW);
  });

  it('leaves a cancelled run on the loading list', () => {
    expect(defaultLoadingView('Cancelled')).toBe(ALL_INVOICES);
  });

  // shipStateName answers undefined for a state it cannot resolve; the loading list is what the
  // screen showed before this rule existed.
  it('falls back to the loading list for an unknown state', () => {
    expect(defaultLoadingView(undefined)).toBe(ALL_INVOICES);
  });
});
