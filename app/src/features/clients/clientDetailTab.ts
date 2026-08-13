/** Which sub-tab of the client detail is open. Lives in the URL as `?tab=`, so
 * a detour into an order detail can return to the tab it left from. */
export type SubTab = 'info' | 'orders' | 'reminders' | 'notes';

const SUB_TABS: SubTab[] = ['info', 'orders', 'reminders', 'notes'];

/** Narrows a `?tab=` value — from a link, a bookmark or a hand-typed URL — to a
 * tab this detail actually has. Anything else falls back to the first one. */
export function clientDetailTab(value: string | null | undefined): SubTab {
  return SUB_TABS.find((t) => t === value) ?? 'info';
}
