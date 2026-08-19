// Shaping logic behind the "Další zboží" card: collapses a run's supplier-good lines into one
// row per good, and works out which underlying line a stepper click should land on.
//
// The same problem the nakládka's own sourcing has, and solved the same way: the operator sees
// one line per thing, while the split is stored per order. Kept out of ShipmentDetail so the
// arithmetic can be tested without a rendering harness.

import type { OutgoingShipmentSupplierGoodDto } from 'src/generated/api-client';

/** One good the run has to bring, summed across every order that asked for it. */
export interface SupplierGoodRow {
  key: string;
  supplierGoodId: string;
  name: string;
  size?: string;
  /** Total pieces across every order on the run. */
  quantity: number;
  /** How many of them come off our own shelf. */
  fromGarage: number;
  /** Pieces in the garage, for the over-draw warning. Undefined when untracked. */
  garageAvailable?: number;
  /** The per-order lines behind the row, in the order the server sent them. */
  sources: OutgoingShipmentSupplierGoodDto[];
}

/**
 * Collapses the per-order lines into one row per good, summing quantities.
 *
 * Keyed on the good's id, not its name: two suppliers may both sell a "CO₂ láhev", and one row
 * covering both would misreport where either is collected from.
 */
export function aggregateSupplierGoods(goods: OutgoingShipmentSupplierGoodDto[]): SupplierGoodRow[] {
  const byGood = new Map<string, SupplierGoodRow>();
  const order: string[] = [];

  for (const g of goods) {
    const id = g.supplierGoodId ?? '';
    let row = byGood.get(id);
    if (!row) {
      row = {
        key: id,
        supplierGoodId: id,
        name: g.name ?? '—',
        size: g.size,
        quantity: 0,
        fromGarage: 0,
        // Every line for a good reports the same on-hand figure; take the first.
        garageAvailable: g.garageAvailable,
        sources: [],
      };
      byGood.set(id, row);
      order.push(id);
    }
    row.quantity += g.quantity ?? 0;
    row.fromGarage += g.quantityFromGarage ?? 0;
    row.sources.push(g);
  }

  return order.map((id) => byGood.get(id)!);
}

/**
 * Which line a stepper click lands on, and the value to write to it.
 *
 * An aggregated row can span several orders, so moving one piece has to pick one of them:
 * increases fill the first line with supplier pieces left, decreases come off the last line
 * that has garage pieces. That keeps repeated clicks from ping-ponging between two orders and
 * makes the sequence of writes deterministic.
 *
 * Null when there is nothing left to move in that direction.
 */
export function nextSourcingWrite(
  row: SupplierGoodRow,
  delta: number,
): { itemId: string; quantityFromGarage: number } | null {
  const target = delta > 0
    ? row.sources.find((s) => (s.quantityFromGarage ?? 0) < (s.quantity ?? 0))
    : [...row.sources].reverse().find((s) => (s.quantityFromGarage ?? 0) > 0);

  if (!target?.id) return null;

  const quantity = target.quantity ?? 0;
  const current = target.quantityFromGarage ?? 0;
  return {
    itemId: target.id,
    quantityFromGarage: Math.max(0, Math.min(current + delta, quantity)),
  };
}

/**
 * Goods drawn from the garage beyond what it holds, for the same warning the nakládka gives
 * about stock. A good the warehouse does not track at all is not over-drawn — there is no
 * figure to be over.
 */
export function overdrawnSupplierGoods(rows: SupplierGoodRow[]): SupplierGoodRow[] {
  return rows.filter((r) => r.garageAvailable != null && r.fromGarage > r.garageAvailable);
}
