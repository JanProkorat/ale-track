/** Which sub-tab of the supplier detail is open. Lives in the URL as `?tab=`, so a
 * bookmarked tab survives a refresh and a detour can return to where it left. */
export type SupplierTab = 'info' | 'hours' | 'cenik' | 'notes';

const SUB_TABS: SupplierTab[] = ['info', 'hours', 'cenik', 'notes'];

/** Narrows a `?tab=` value — from a link, a bookmark or a hand-typed URL — to a tab this
 * detail actually has. Anything else falls back to the first one. */
export function supplierDetailTab(value: string | null | undefined): SupplierTab {
  return SUB_TABS.find((t) => t === value) ?? 'info';
}
