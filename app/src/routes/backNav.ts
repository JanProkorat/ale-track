/**
 * Where a detail screen's back arrow should return to when the screen was
 * opened from somewhere other than its own list — e.g. an order opened from a
 * vývoz detail goes back to that vývoz, not to /orders.
 *
 * Carried in the router's location state rather than derived from history, so
 * a hard refresh on the deep-linked detail keeps the right target (the browser
 * persists history state) and the target screen never has to guess.
 */
export type DetailBackState = {
  /** Absolute in-app path the back arrow navigates to. */
  backTo: string;
  /** Accessible name and tooltip for the arrow, e.g. "Zpět na vývoz". */
  backLabel: string;
};

/**
 * Narrows `useLocation().state` — which is whatever the browser kept, from any
 * app version — to a usable back target, or `undefined` when the screen was
 * reached without one.
 */
export function detailBackState(state: unknown): DetailBackState | undefined {
  const candidate = state as Partial<DetailBackState> | null | undefined;
  if (typeof candidate?.backTo !== 'string' || typeof candidate.backLabel !== 'string') {
    return undefined;
  }

  return { backTo: candidate.backTo, backLabel: candidate.backLabel };
}
