// The dovoz editor's draft model: the shape it edits, and the pure functions that turn it into a
// wire payload or a snapshot. Kept out of DeliveryEditor so the parts worth testing can be tested
// without a render, the way shipmentDraft.ts sits beside the vývoz editor.

import type { Dayjs } from 'dayjs';
import { DeliveryStopKind, type SupplierChargeKind } from 'src/generated/api-client';
import { chargeKindName } from 'src/lib/labels';

/** One line of a stop: a brewery product, or one charge kind of a supplier's good.
 *
 * The charge kind is part of a good line's identity rather than a detail hanging off it — the same
 * bottle can be on one trip to be refilled and to be paid rent on, at two different prices. */
export type DraftLine =
  | { source: 'product'; productId: string; quantity: number; note?: string }
  | { source: 'good'; supplierGoodId: string; chargeKind: SupplierChargeKind; quantity: number; note?: string };

/** A route stop: a brewery (with its product list), a supplier (with its price list), or a
 * custom free-form waypoint (label + coordinates, no items). */
export interface DraftStop {
  key: string;
  publicId?: string;
  kind: 'brewery' | 'supplier' | 'custom';
  breweryId: string; // '' unless a brewery stop
  supplierId: string; // '' unless a supplier stop
  note: string;
  items: DraftLine[]; // [] for custom stops
  label?: string; // custom stops only
  lat?: number; // custom stops only
  lng?: number; // custom stops only
}

/** Stable identity of a line, for cart lookups and quantity edits.
 *
 * Goes through chargeKindName rather than the raw value because a line loaded from the API carries
 * the wire string while one just added carries the numeric enum member — the same line by two
 * names would show up in the cart twice. */
export function lineKey(line: DraftLine): string {
  return line.source === 'product'
    ? `p:${line.productId}`
    : `g:${line.supplierGoodId}:${chargeKindName(line.chargeKind) ?? ''}`;
}

/** Whether two lines are the same line. */
export function sameLine(a: DraftLine, b: DraftLine): boolean {
  return lineKey(a) === lineKey(b);
}

/** Serialized snapshot of the savable state, for unsaved-change detection. */
export function serializeDelivery(
  date: Dayjs | null,
  vehicleId: string | null,
  driverIds: string[],
  note: string,
  stops: DraftStop[],
): string {
  return JSON.stringify({
    date: date ? date.toISOString() : null,
    vehicleId,
    driverIds: [...driverIds].sort(),
    note: note.trim(),
    stops: stops.map((s) => ({
      kind: s.kind,
      breweryId: s.breweryId,
      supplierId: s.supplierId,
      note: s.note.trim(),
      // Lines by their identity plus what is editable about them, so a snapshot does not change
      // when the same line arrives with the enum in its other wire form.
      items: s.items.map((i) => ({ key: lineKey(i), quantity: i.quantity, note: i.note?.trim() ?? '' })),
      label: s.label,
      lat: s.lat,
      lng: s.lng,
    })),
  });
}

const STOP_KIND: Record<DraftStop['kind'], DeliveryStopKind> = {
  brewery: DeliveryStopKind.Brewery,
  supplier: DeliveryStopKind.Supplier,
  custom: DeliveryStopKind.Custom,
};

/** The wire fields of a stop, shared by the create and update payloads.
 *
 * The two DTOs differ only by the stop's publicId, and the backend rejects a stop carrying another
 * kind's place — so a field set in one mapping and forgotten in the other is a stop that fails
 * validation or silently loses where it was going. Written once for both. */
export function stopWireFields(s: DraftStop) {
  return {
    kind: STOP_KIND[s.kind],
    breweryId: s.kind === 'brewery' ? s.breweryId : undefined,
    supplierId: s.kind === 'supplier' ? s.supplierId : undefined,
    label: s.kind === 'custom' ? s.label : undefined,
    latitude: s.kind === 'custom' ? s.lat : undefined,
    longitude: s.kind === 'custom' ? s.lng : undefined,
    note: s.note.trim() || undefined,
  };
}

/** The wire fields of one line — exactly one of the two sources, as the backend requires. */
export function lineWireFields(line: DraftLine) {
  const note = line.note?.trim() || undefined;
  return line.source === 'product'
    ? { productId: line.productId, quantity: line.quantity, note }
    : { supplierGoodId: line.supplierGoodId, chargeKind: line.chargeKind, quantity: line.quantity, note };
}
