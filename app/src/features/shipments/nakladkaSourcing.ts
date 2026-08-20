// Which stock entries a shipment draws more from than they hold.
//
// Sourcing is recorded per order item, so one stock entry can be drawn by several
// stops at once — the shortage only shows up once they are summed. Extracted from
// ShipmentDetail so the arithmetic can be tested without a rendering harness.

import type { OutgoingShipmentStopDto } from 'src/generated/api-client';

/**
 * Whether a shipment in this state has already taken its sourced pieces off the shelf.
 *
 * The backend draws stock down on the transition into Loaded and puts it back on every
 * transition out of the drawn set, so the state alone answers the question — mirrors
 * `ShipmentStateTransition.IsStockDrawn` on the API side.
 */
export function isStockDrawn(stateName?: string): boolean {
  return stateName === 'Loaded' || stateName === 'InTransit' || stateName === 'Delivered';
}

export interface OverdrawnStock {
  /** Display name of the stock entry. */
  name: string;
  /** Pieces this shipment takes from it, across every stop. */
  taken: number;
  /** Pieces currently on hand. */
  available: number;
}

/**
 * Stock entries whose planned draw exceeds what is on hand, in first-seen order.
 *
 * Being over-drawn is deliberately not an error: a booked delivery may still land
 * before the truck is loaded. The caller warns rather than blocks.
 *
 * Only meaningful while the draw is still a *reservation*. Past the Loaded boundary the
 * pieces are off the shelf and the on-hand figure no longer contains them, so the same
 * comparison reads every loaded run as over-drawn — 40 on hand, 30 loaded, 10 left, and a
 * banner announcing that 30 were taken against a stock of 10. Hence the `stateName` guard:
 * once the goods have moved there is nothing left to warn about, because the warning was
 * only ever about a plan that stock might not cover.
 */
export function overdrawnStock(stops: OutgoingShipmentStopDto[], stateName?: string): OverdrawnStock[] {
  if (isStockDrawn(stateName)) return [];

  const drawn = new Map<string, OverdrawnStock>();

  for (const stop of stops) {
    for (const product of stop.products ?? []) {
      const id = product.inventoryItemId;
      const taken = product.quantityFromInventory ?? 0;
      if (!id || taken <= 0) continue;

      const entry = drawn.get(id) ?? {
        name: product.inventoryItemName ?? product.name ?? '—',
        taken: 0,
        // Every row for a given entry reports the same on-hand figure; take the first.
        available: product.inventoryItemAvailable ?? 0,
      };
      entry.taken += taken;
      drawn.set(id, entry);
    }
  }

  return [...drawn.values()].filter((e) => e.taken > e.available);
}
