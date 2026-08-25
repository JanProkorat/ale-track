// The recording drawer's product picker, grouped the way the catalog groups: brewery, then kind.
//
// A flat list of every product in the catalog is unusable at this size — the operator knows the
// brewery and the packaging before the name, which is the order the catalog puts them in. The
// grouping is the picker's alone; nothing else about the catalog changes.

import type { ComboOption } from 'src/components/common/Combobox';
import type { ProductListItemDto } from 'src/generated/api-client';
import { fmtLiters } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';

/** Products with no brewery of their own still need a heading to sit under. */
const UNGROUPED = 'Ostatní';

const CS = 'cs';

/**
 * Brewery · kind, which is what one heading of the list covers.
 *
 * A missing brewery is named rather than dropped: a heading reading only "Sud" would sit next to
 * "Svijany · Sud" with nothing to say whose it is.
 */
function groupOf(product: ProductListItemDto): string {
  return [product.breweryName || UNGROUPED, kindLabel(product.kind)].filter(Boolean).join(' · ');
}

/** Nulls last, so a product with no display order does not lead the list. */
function order(value: number | undefined): number {
  return value ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Catalog order: brewery as the catalog ranks it, then kind, then the product, then its size.
 *
 * Brewery before kind is what keeps each heading contiguous — MUI repeats a heading if its
 * options are not adjacent, so the sort is what makes the grouping hold rather than a detail
 * of presentation.
 */
function compare(a: ProductListItemDto, b: ProductListItemDto): number {
  return order(a.breweryDisplayOrder) - order(b.breweryDisplayOrder)
    || (a.breweryName ?? '').localeCompare(b.breweryName ?? '', CS)
    || (kindLabel(a.kind) ?? '').localeCompare(kindLabel(b.kind) ?? '', CS)
    || order(a.displayOrder) - order(b.displayOrder)
    || (a.name ?? '').localeCompare(b.name ?? '', CS)
    || (a.packageSize ?? 0) - (b.packageSize ?? 0);
}

/**
 * The picker's options: everything in the catalog except what already has a row on the form.
 *
 * The size is the second line rather than part of the name: a brewery's product comes in five of
 * them, and the closed field should read as the product.
 */
export function productPickerOptions(
  products: ProductListItemDto[] | undefined,
  exclude: ReadonlySet<string | undefined>,
): ComboOption[] {
  return (products ?? [])
    .filter((p) => p.id && !exclude.has(p.id))
    .slice()
    .sort(compare)
    .map((p) => ({
      value: p.id!,
      label: p.name ?? '—',
      group: groupOf(p),
      secondary: p.packageSize != null ? fmtLiters(p.packageSize) : undefined,
    }));
}
