import { describe, expect, it } from 'vitest';
import { Capability as ApiCapability } from 'src/generated/api-client';
import { CAPABILITY_REGISTRY } from './capabilityRegistry';

describe('capability registry', () => {
  // A guardsData capability is named by RequireCapability on the server. If a rename splits
  // the two, the endpoint stops matching and the gate silently opens — so this fails loudly.
  it('gives every server-enforced capability a key matching the generated enum', () => {
    const apiNames = Object.keys(ApiCapability).filter((k) => Number.isNaN(Number(k)));
    const guarded = CAPABILITY_REGISTRY.filter((c) => c.guardsData);

    // An empty list here would make the loop below run zero assertions and pass vacuously,
    // silently stopping the guard from guarding anything.
    expect(guarded.length).toBeGreaterThan(0);

    for (const entry of guarded) {
      expect(apiNames).toContain(entry.key);
    }
  });

  it('has no duplicate keys', () => {
    const keys = CAPABILITY_REGISTRY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
