// Price-list shaping for Dodavatelé, plus the list's search key. Pure, so the ordering
// and the money-summary rules are unit-tested rather than inferred from a rendered table.

import { SupplierChargeKind, type SupplierGoodDto, type SupplierListItemDto } from 'src/generated/api-client';
import { chargeKindName } from 'src/lib/labels';

/** The order a price list reads in: what you pay most often first, oddities last. */
export const CHARGE_ORDER: SupplierChargeKind[] = [
  SupplierChargeKind.Fill,
  SupplierChargeKind.Purchase,
  SupplierChargeKind.Deposit,
  SupplierChargeKind.Rent,
  SupplierChargeKind.Other,
];

/** Ordinal of a charge kind, resolved from either wire representation. */
function chargeRank(kind: SupplierChargeKind | string | number | undefined): number {
  const name = chargeKindName(kind);
  const index = CHARGE_ORDER.findIndex((k) => chargeKindName(k) === name);
  return index === -1 ? CHARGE_ORDER.length : index;
}

/**
 * A good's prices in reading order.
 *
 * The detail endpoint already sorts them, so this is belt-and-braces for the one caller
 * that cannot rely on it: a good just written in the drawer and rendered from local state
 * before the refetch lands.
 */
export function pricesOrdered(good: SupplierGoodDto): NonNullable<SupplierGoodDto['prices']> {
  return [...(good.prices ?? [])].sort((a, b) => chargeRank(a.kind) - chargeRank(b.kind));
}

/** How many price rows a supplier's whole list holds — goods × their charge kinds. */
export function priceCount(goods: SupplierGoodDto[] | undefined): number {
  return (goods ?? []).reduce((n, g) => n + (g.prices?.length ?? 0), 0);
}

/**
 * The cheapest refill on the list, or null when the supplier refills nothing.
 *
 * Refills are the recurring cost — a bottle is bought once and filled for years — so this
 * is the number worth comparing between two suppliers, and the one the detail surfaces.
 */
export function cheapestFill(goods: SupplierGoodDto[] | undefined): number | null {
  const fills = (goods ?? [])
    .flatMap((g) => g.prices ?? [])
    .filter((p) => chargeKindName(p.kind) === 'Fill')
    .map((p) => p.priceWithVat ?? 0);
  return fills.length > 0 ? Math.min(...fills) : null;
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Search key: folds diacritics and the subscript digits gas names are written with.
 *
 * Nobody types "CO₂" on a keyboard, so "co2" has to match it — the same way "frydlant"
 * matches "Frýdlant". Without the subscript fold, every gas product on the list is
 * unreachable by search, which is how the prototype's first cut behaved.
 */
export function supplierSearchKey(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[₀-₉]/g, (d) => String(SUBSCRIPT_DIGITS.indexOf(d)));
}

/**
 * Whether a list row matches a query — by its own name, its business name, its city, or
 * anything it sells. Goods matter because "who refills Biogon" is how the question
 * actually arrives, and the supplier's own name never contains it.
 */
export function matchesSupplierSearch(
  row: Pick<SupplierListItemDto, 'name' | 'businessName' | 'officialAddress'> & {
    goodNames?: (string | undefined)[];
  },
  query: string,
): boolean {
  const q = supplierSearchKey(query);
  if (!q) return true;

  const haystacks = [
    row.name,
    row.businessName,
    row.officialAddress?.city,
    ...(row.goodNames ?? []),
  ];

  return haystacks.some((value) => supplierSearchKey(value).includes(q));
}
