// The checklist every new shipment starts with. It is the same list before every departure, so
// the editor prefills it rather than making the planner retype it.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECKLIST_LABELS, defaultChecklistSteps } from './preparationStepModel';

describe('defaultChecklistSteps', () => {
  it('prefills the standard pre-departure list in order', () => {
    expect(defaultChecklistSteps().map((s) => s.label)).toEqual([
      'Rudlík',
      'Parkovací karta',
      'Soupis',
      'Vozejk',
      'Klíče',
      'Co2',
      'Biogon',
      'Prázdné',
      'Reklamace',
      'Věci z předchozího vývozu',
    ]);
  });

  it('carries no server IDs', () => {
    // These rows do not exist yet; an ID would make the server look for a step to update.
    expect(defaultChecklistSteps().every((s) => s.id === undefined)).toBe(true);
  });

  it('gives every row its own key', () => {
    const keys = defaultChecklistSteps().map((s) => s.key);

    expect(new Set(keys).size).toBe(DEFAULT_CHECKLIST_LABELS.length);
  });

  it('hands out a fresh set each call, so one shipment cannot edit another\'s', () => {
    const first = defaultChecklistSteps();
    first[0].label = 'Něco jiného';

    expect(defaultChecklistSteps()[0].label).toBe('Rudlík');
  });
});
