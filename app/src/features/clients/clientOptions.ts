import type { Region } from 'src/generated/api-client';
import type { ComboOption } from 'src/components/common/Combobox';
import { L, regionLabel } from 'src/lib/labels';

/**
 * The fields a picker option needs from a client.
 *
 * Structural rather than `ClientDto`, because the detail DTO and the list DTO both satisfy it — the
 * order editor holds the former, the sale editor the latter, and neither should have to cast.
 */
export interface ClientOptionSource {
  id?: string;
  name?: string;
  /** Trading name — two clients may share a `name`, and this is what separates them. */
  businessName?: string;
  region?: Region;
}

const COLLATOR = new Intl.Collator('cs');

/** Clients whose region is unset, or explicitly the enum's own catch-all, share
 * one bucket sorted to the bottom — a heading per unknown region would split
 * the tail of the list for no gain. */
const OTHER = L.region.Other;

/** Client picker options grouped by region: regions in Czech alphabetical order
 * with "Ostatní" last, clients inside each region by name. The `group` label is
 * what the collapsible header shows, so it is the Czech label, not the enum
 * member name.
 *
 * The trading name rides along as the option's second line, because a name is not unique:
 * two clients called "Hospoda Na Rohu" are one legal entity and one family business, and
 * with the name alone the picker offered two identical-looking rows. Only where there is
 * one — it is optional on the client, and a blank second line would just make the row
 * taller. */
export function clientComboOptions(clients: readonly ClientOptionSource[]): ComboOption[] {
  return clients
    .map((c) => ({
      value: c.id ?? '',
      label: c.name ?? '',
      secondary: c.businessName?.trim() || undefined,
      group: regionLabel(c.region) ?? OTHER,
    }))
    .sort((a, b) => {
      if (a.group !== b.group) {
        if (a.group === OTHER) return 1;
        if (b.group === OTHER) return -1;
        return COLLATOR.compare(a.group, b.group);
      }
      // Same name, different subject: order them by the trading name so the pair keeps a
      // stable order between renders rather than falling back on the source's.
      if (a.label === b.label) return COLLATOR.compare(a.secondary ?? '', b.secondary ?? '');
      return COLLATOR.compare(a.label, b.label);
    });
}
