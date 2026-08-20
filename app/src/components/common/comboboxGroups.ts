import type { ComboOption } from './Combobox';

/** Prefixes a header row's synthetic `value`. Verbose on purpose: header rows
 * share the option list with real choices, and this must never collide with a
 * real value (an id, an enum member name). */
export const GROUP_ROW_PREFIX = '__combobox_group__:';

/** One listbox row. Headers and choices share a type because MUI's Autocomplete
 * takes a single homogeneous option list — a header rendered any other way
 * (MUI's own `groupBy`) is invisible to the option indices the keyboard walks,
 * so hiding a collapsed group's children would strand the highlight on rows
 * that have no DOM node. */
export interface ComboRow extends ComboOption {
  /** True on a group's title row, which toggles the group instead of picking. */
  header?: boolean;
  /** Header rows only: how many choices the group holds, collapsed or not. */
  count?: number;
  /** Header rows only: whether the group is currently folded shut. */
  collapsed?: boolean;
}

/** Flattens grouped options into header + choice rows, dropping the choices of
 * collapsed groups. Group and item order is the caller's — this only inserts
 * headers, so a caller's sort survives.
 *
 * `options` is expected to be the already-filtered list, so a group whose items
 * all failed the search drops out with them. `ignoreCollapsed` is set while a
 * search is running: a typed name must never be hidden behind a folded group.
 */
export function buildGroupRows(
  options: readonly ComboOption[],
  collapsed: ReadonlySet<string>,
  ignoreCollapsed: boolean,
): ComboRow[] {
  const rows: ComboRow[] = [];
  const byGroup = new Map<string, ComboOption[]>();

  for (const option of options) {
    if (!option.group) {
      rows.push(option);
      continue;
    }
    const bucket = byGroup.get(option.group);
    if (bucket) {
      bucket.push(option);
    } else {
      byGroup.set(option.group, [option]);
    }
  }

  for (const [group, items] of byGroup) {
    const folded = !ignoreCollapsed && collapsed.has(group);
    rows.push({
      value: `${GROUP_ROW_PREFIX}${group}`,
      label: group,
      group,
      header: true,
      count: items.length,
      collapsed: folded,
    });
    if (!folded) {
      rows.push(...items);
    }
  }

  return rows;
}
