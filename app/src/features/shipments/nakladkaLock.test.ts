import { describe, expect, it } from 'vitest';
import { nakladkaLock } from './nakladkaLock';

describe('nakladkaLock', () => {
  it('leaves a run that is still being planned open', () => {
    expect(nakladkaLock('Created')).toBe('open');
  });

  it.each(['Loaded', 'InTransit'])('locks a packed run, unlockably (%s)', (state) => {
    expect(nakladkaLock(state)).toBe('locked');
  });

  it.each(['Delivered', 'Cancelled'])('closes a finished run for good (%s)', (state) => {
    expect(nakladkaLock(state)).toBe('closed');
  });

  // The name arrives from shipStateName, which answers undefined for a state it cannot resolve.
  // Reading that as open matches what the screen did before the lock existed.
  it('treats an unknown state as open', () => {
    expect(nakladkaLock(undefined)).toBe('open');
  });
});
