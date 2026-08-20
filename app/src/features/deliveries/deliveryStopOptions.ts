// What the "add a stop" picker offers. Pure, because the interesting rules — a place already on the
// route is not offered again, and suppliers are offered only to a user who may read them — are
// worth testing without standing up the editor.

import type { ComboOption } from 'src/components/common/Combobox';

/** The two id spaces are both GUIDs, so a value has to say which list it came from. */
export type StopOptionKind = 'brewery' | 'supplier';

export interface StopPlace {
  id?: string;
  name?: string;
}

/** Parses a picker value back into the place it names. Returns null for anything malformed. */
export function parseStopOption(value: string): { kind: StopOptionKind; id: string } | null {
  const [kind, id] = value.split(':');
  if (!id) return null;
  if (kind !== 'brewery' && kind !== 'supplier') return null;
  return { kind, id };
}

/**
 * One grouped option list rather than two controls: the dovoz editor's single field now covers both
 * kinds of place a van collects from.
 *
 * The Dodavatelé group is omitted entirely without the Suppliers permission — the API refuses that
 * list, so offering names it will not serve would be a picker whose entries fail on click.
 */
export function buildStopOptions({
  breweries,
  suppliers,
  usedBreweryIds,
  usedSupplierIds,
  canSeeSuppliers,
}: {
  breweries: StopPlace[];
  suppliers: StopPlace[];
  usedBreweryIds: ReadonlySet<string>;
  usedSupplierIds: ReadonlySet<string>;
  canSeeSuppliers: boolean;
}): ComboOption[] {
  const options: ComboOption[] = breweries
    .filter((b) => !usedBreweryIds.has(b.id ?? ''))
    .map((b) => ({ value: `brewery:${b.id ?? ''}`, label: b.name ?? '', group: 'Pivovary' }));

  if (!canSeeSuppliers) return options;

  return [
    ...options,
    ...suppliers
      .filter((s) => !usedSupplierIds.has(s.id ?? ''))
      .map((s) => ({ value: `supplier:${s.id ?? ''}`, label: s.name ?? '', group: 'Dodavatelé' })),
  ];
}
