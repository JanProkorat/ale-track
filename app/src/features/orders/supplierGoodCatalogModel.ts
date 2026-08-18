// Shaping logic behind the order editor's "Další zboží" tab — the non-beer lines
// bought off a supplier's price list. Kept out of OrderEditor.tsx so the pricing
// and search rules can be tested without a rendering harness.

import { type SupplierDto, type SupplierGoodDto, SupplierChargeKind } from 'src/generated/api-client';
// The Dodavatelé module's own search key: folds diacritics and the subscript digits
// gas names are written with, so "co2" matches "CO₂". Reused rather than reimplemented —
// two folds that drift apart would make the same query behave differently per screen.
import { supplierSearchKey } from 'src/features/suppliers/supplierGoods';

/** One supplier and the goods of theirs that survived the search filter. */
export interface SupplierGoodGroup {
  supplierId: string;
  supplierName: string;
  goods: SupplierGoodDto[];
}

/** A good paired with the supplier it belongs to, for cart and detail rendering. */
export interface ResolvedGood {
  good: SupplierGoodDto;
  supplierId: string;
  supplierName: string;
}

/**
 * The one price an order line shows for a good: its Plnění (refill) price, or the
 * first price it has when it prices no refill.
 *
 * Mirrors the backend projection in GetOrderDetailEndpoint, and has to: the picker
 * prices a line before it is saved, the detail screen prices it after, and the two
 * numbers disagreeing would read as the price having changed on save.
 */
export function primaryPrice(good: SupplierGoodDto | undefined): { price: number; kind?: SupplierChargeKind } | undefined {
  const prices = good?.prices ?? [];
  if (prices.length === 0) return undefined;
  const chosen = prices.find((p) => p.kind === SupplierChargeKind.Fill) ?? prices[0];
  return { price: chosen.priceWithVat ?? 0, kind: chosen.kind };
}

/**
 * Groups the loaded suppliers' price lists for the picker, filtered by the search
 * term and sorted by supplier name.
 *
 * A search hit on the supplier's own name keeps all of its goods — "what does Linde
 * sell" is as real a question as "who refills Biogon", and a supplier whose name
 * matched but whose goods did not would otherwise render as an empty panel.
 * Suppliers with no goods at all are dropped: there is nothing to add from them.
 */
export function groupSupplierGoods(
  suppliers: SupplierDto[],
  search: string,
): SupplierGoodGroup[] {
  const q = supplierSearchKey(search);
  return suppliers
    .map((s) => {
      const supplierMatches = !q || supplierSearchKey(s.name).includes(q);
      const goods = (s.goods ?? []).filter((g) => supplierMatches || supplierSearchKey(g.name).includes(q));
      return { supplierId: s.id ?? '', supplierName: s.name ?? '', goods };
    })
    .filter((g) => g.goods.length > 0)
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'cs'));
}

/** Flat good-id → (good, supplier) lookup, so a cart line renders without a second pass. */
export function resolvedGoodMap(suppliers: SupplierDto[]): Map<string, ResolvedGood> {
  const map = new Map<string, ResolvedGood>();
  for (const s of suppliers) {
    for (const g of s.goods ?? []) {
      if (g.id) map.set(g.id, { good: g, supplierId: s.id ?? '', supplierName: s.name ?? '' });
    }
  }
  return map;
}
