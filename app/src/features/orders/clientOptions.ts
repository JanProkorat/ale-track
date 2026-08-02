import type { ClientDto } from 'src/generated/api-client';
import type { ComboOption } from 'src/components/common/Combobox';
import { L, regionLabel } from 'src/lib/labels';

const COLLATOR = new Intl.Collator('cs');

/** Clients whose region is unset, or explicitly the enum's own catch-all, share
 * one bucket sorted to the bottom — a heading per unknown region would split
 * the tail of the list for no gain. */
const OTHER = L.region.Other;

/** Client picker options grouped by region: regions in Czech alphabetical order
 * with "Ostatní" last, clients inside each region by name. The `group` label is
 * what the collapsible header shows, so it is the Czech label, not the enum
 * member name. */
export function clientComboOptions(clients: readonly ClientDto[]): ComboOption[] {
  return clients
    .map((c) => ({ value: c.id ?? '', label: c.name ?? '', group: regionLabel(c.region) ?? OTHER }))
    .sort((a, b) => {
      if (a.group !== b.group) {
        if (a.group === OTHER) return 1;
        if (b.group === OTHER) return -1;
        return COLLATOR.compare(a.group, b.group);
      }
      return COLLATOR.compare(a.label, b.label);
    });
}
