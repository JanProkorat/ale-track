// Which stock entries a shipment draws more from than they hold.
//
// Sourcing is recorded per order item, so one stock entry can be drawn by several
// stops at once — the shortage only shows up once they are summed. Extracted from
// ShipmentDetail so the arithmetic can be tested without a rendering harness.

import type { OutgoingShipmentStopDto } from 'src/generated/api-client';

export interface OverdrawnStock {
  /** Display name of the stock entry. */
  name: string;
  /** Pieces this shipment takes from it, across every stop. */
  taken: number;
  /** Pieces currently on hand. */
  available: number;
}

/**
 * Stock entries whose drawn total exceeds what is on hand, in first-seen order.
 *
 * Being over-drawn is deliberately not an error: a booked delivery may still land
 * before the truck is loaded. The caller warns rather than blocks.
 */
export function overdrawnStock(stops: OutgoingShipmentStopDto[]): OverdrawnStock[] {
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
