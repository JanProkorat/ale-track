// The wording the transition overlay shows. Worth pinning because the point of the overlay is
// that it names the *consequences* — a user who sees "Nakládám vývoz…" and nothing else has no
// idea why the button is taking a moment, which is the complaint this replaced.

import { describe, expect, it } from 'vitest';
import { OutgoingShipmentState } from 'src/generated/api-client';
import { stateChangeProgress } from './shipmentStateProgress';

describe('stateChangeProgress', () => {
  it('names the stock movement when loading', () => {
    const { title, detail } = stateChangeProgress(OutgoingShipmentState.Loaded);
    expect(title).toBe('Nakládám vývoz…');
    expect(detail).toMatch(/skladu/);
  });

  it('names the stock return when reverting to planning', () => {
    expect(stateChangeProgress(OutgoingShipmentState.Created).detail).toMatch(/zpět na sklad/);
  });

  it('names the stock return when cancelling', () => {
    expect(stateChangeProgress(OutgoingShipmentState.Cancelled).detail).toMatch(/na sklad/);
  });

  it('covers every state the detail screen can move to', () => {
    const states = [
      OutgoingShipmentState.Created,
      OutgoingShipmentState.Loaded,
      OutgoingShipmentState.InTransit,
      OutgoingShipmentState.Delivered,
      OutgoingShipmentState.Cancelled,
    ];

    // A state falling through to the generic message would still render, which is why this
    // asserts distinctness rather than merely "not empty".
    const titles = states.map((s) => stateChangeProgress(s).title);
    expect(new Set(titles).size).toBe(states.length);
  });

  it('falls back rather than rendering an empty overlay for an unknown state', () => {
    const { title, detail } = stateChangeProgress(99 as OutgoingShipmentState);
    expect(title).toBeTruthy();
    expect(detail).toBeTruthy();
  });
});
