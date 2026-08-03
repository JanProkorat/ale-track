// The shape the vývoz editor holds its checklist in, kept out of the component file so
// PreparationStepsEditor.tsx exports nothing but the component.

/** A checklist row being edited. `id` is the server's public ID — absent for a row added in this
 *  session, which is how the server tells a new row from an existing one whose tick it must keep.
 *  `key` is local and stable, so React keeps the row's input focused while typing. */
export interface DraftStep {
  key: string;
  id?: string;
  label: string;
}

/** Matches the backend's `label` column. */
export const STEP_LABEL_MAX = 200;

/**
 * What gets checked before every departure. Prefilled into each new shipment, and editable from
 * there — a run that needs something else added or a row dropped changes its own copy, which is
 * why these live here as a starting point rather than as a shared template entity.
 */
export const DEFAULT_CHECKLIST_LABELS = [
  'Rudlík',
  'Tankovací karta',
  'Soupis',
  'Vozejk',
  'Klíče',
  'Co2',
  'Biogon',
  'Prázdné',
  'Reklamace',
  'Bonusy',
  'Věci z předchozího vývozu',
] as const;

let nextKey = 0;

export function newDraftStep(label = ''): DraftStep {
  nextKey += 1;
  return { key: `new-${nextKey}`, label };
}

/** The prefilled checklist for a brand-new shipment. */
export function defaultChecklistSteps(): DraftStep[] {
  return DEFAULT_CHECKLIST_LABELS.map((label) => newDraftStep(label));
}
