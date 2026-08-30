// Which view the "Rozpis zboží" card opens on, and the two tab values that are not invoice
// sequences.
//
// The card served the packing of the van, so it always opened on the loading list — which is
// finished reading once the van has left. From Na cestě onwards the stop-by-stop unload order is
// what the office and the driver are working through, so that is what the card opens on.

/** Tab value for the unfiltered loading list; the rest are invoice sequences. */
export const ALL_INVOICES = 'all';

/** Tab value for the driver's stop-by-stop unload view; every other option
 * filters the loading list instead. A plain string, not a sequence — the
 * invoice tabs' values are `String(sequence)`, always numeric, so there is no
 * real collision risk, but this reads clearly in the SegControl regardless. */
export const UNLOAD_VIEW = 'unload';

/**
 * The view a run in this state opens on. Takes the state's member name, as `shipStateName` gives it.
 *
 * Doručeno answers the same as Na cestě rather than falling back to the loading list: a run that
 * arrives while the screen is open would otherwise snap back to a list that is now history, and a
 * finished run's unload view is the record of what actually arrived.
 */
export function defaultLoadingView(stateName: string | undefined): string {
  return stateName === 'InTransit' || stateName === 'Delivered' ? UNLOAD_VIEW : ALL_INVOICES;
}
