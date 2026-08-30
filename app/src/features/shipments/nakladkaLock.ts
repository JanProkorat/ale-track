// Whether the nakládka table takes edits, keyed on the run's state.
//
// Three values rather than a boolean, because a packed truck and a finished run are locked for
// different reasons: the first is a plan the office should not disturb by accident but may still
// have to correct, the second is a historical record. Only the first offers the unlock.
//
// Deliberately narrower than the card's other edit gates: the preparation checklist, the supplier
// goods and Fakturace are all worked through *after* loading, so they keep reading the run's own
// editability and never this.

export type NakladkaLock =
  /** Still being planned — edits as usual. */
  | 'open'
  /** Packed: read-only, with the emergency unlock on offer. */
  | 'locked'
  /** Delivered or cancelled — a record, with no way back in. */
  | 'closed';

/** Takes the state's member name, as `shipStateName` gives it. */
export function nakladkaLock(stateName: string | undefined): NakladkaLock {
  if (stateName === 'Loaded' || stateName === 'InTransit') return 'locked';
  if (stateName === 'Delivered' || stateName === 'Cancelled') return 'closed';
  return 'open';
}
