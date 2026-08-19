// What each kind of stop is called and where it is, for the route's stop list.
//
// The list shows every stop the route has — client deliveries, supplier pickups, the warehouse,
// custom waypoints — because the numbers beside them are the numbers on the map pins, and a list
// that skipped a kind would number the rest wrongly. Kept out of ShipmentDetail so the per-kind
// resolution can be tested without a rendering harness.

import { type OutgoingShipmentStopDto } from 'src/generated/api-client';
import { formatStreetAddress } from 'src/features/clients/deliveryPlaceFormat';
import { stopKindName } from 'src/lib/labels';
import { resolveDetailStopAddress } from './stopAddress';

/** One line of the stop list, already resolved to what it should say. */
export interface StopOverviewEntry {
  key: string;
  /**
   * The stop's own public id. Distinct from {@link key}, which is the *order* id for a delivery
   * stop — the reorder endpoint keys on stops, so it needs this one. Absent only if the server
   * ever omitted it, which disables reordering rather than posting a guess.
   */
  stopId?: string;
  /** Position on the route — the same number the map pin carries. */
  seq: number;
  kind: 'order' | 'supplier' | 'company' | 'custom';
  title: string;
  /** Where the stop is, without the address-kind tail. */
  addressLine?: string;
  /** A client's saved place, when the stop delivers to one. */
  placeName?: string;
  /** The order behind an order stop, so the row can open it. */
  orderId?: string;
  /** Colour key for the numbered avatar; only order stops are coloured per client. */
  clientId?: string;
  /** A custom stop's own note. */
  note?: string;
}

/**
 * Describes every stop in route order, numbered from 1.
 *
 * Numbered by route position rather than by position among stops of one kind: the map pins are
 * numbered over the whole route, so anything else makes the list and the map disagree about
 * which stop is "3".
 */
export function stopOverviewEntries(stops: OutgoingShipmentStopDto[]): StopOverviewEntry[] {
  return stops.map((stop, i) => {
    const seq = i + 1;
    const kindName = stopKindName(stop.kind);

    if (stop.orderId != null) {
      // The chip carries the place name; the address line never repeats it
      // (formatPlaceAddress only formats the address part). resolveDetailStopAddress is the
      // single place that normalizes the wire's string-enum selectedAddressKind.
      const resolved = resolveDetailStopAddress(stop);
      const isPlace = resolved.isPlace && stop.deliveryPlace != null;
      return {
        key: stop.orderId,
        stopId: stop.id,
        seq,
        kind: 'order',
        title: stop.clientName ?? '—',
        addressLine: resolved.addressText,
        placeName: isPlace ? stop.deliveryPlace?.name ?? '—' : undefined,
        orderId: stop.orderId,
        clientId: stop.clientId ?? '',
      };
    }

    if (kindName === 'Supplier') {
      return {
        key: stop.id ?? `supplier-${i}`,
        stopId: stop.id,
        seq,
        kind: 'supplier',
        // The stop's own label, not the live supplier name: it was written when the stop was
        // created, so it still reads correctly if the supplier has since been removed.
        title: stop.label ?? '—',
        addressLine: stop.supplierAddress ? formatStreetAddress(stop.supplierAddress) : undefined,
      };
    }

    if (kindName === 'Company') {
      return {
        key: stop.id ?? `company-${i}`,
        stopId: stop.id,
        seq,
        kind: 'company',
        title: stop.label ?? 'Firemní sklad',
      };
    }

    return {
      key: stop.id ?? `custom-${i}`,
      stopId: stop.id,
      seq,
      kind: 'custom',
      title: stop.label ?? 'Zastávka',
      note: stop.note,
    };
  });
}

/**
 * The whole sequence with one stop moved, as the stop ids the reorder endpoint wants.
 *
 * `move` gives a relative step (the arrow buttons); `dropOn` names the row landed on (a drag).
 * Null when the move is impossible or a no-op, so the caller can disable the control and never
 * post a sequence the run cannot have. One home for the off-by-one, since both controls use it.
 *
 * Null too if any stop is missing its own id: the endpoint requires *every* stop of the run, so
 * a partial list would be rejected anyway — better not to send it.
 */
export function reorderedStopIds(
  entries: StopOverviewEntry[],
  target: string,
  move: { delta: number } | { dropOn: string },
): string[] | null {
  const ids = entries.map((e) => e.stopId);
  if (ids.some((id) => !id)) return null;

  const from = entries.findIndex((e) => e.key === target);
  if (from < 0) return null;

  const to = 'delta' in move
    ? from + move.delta
    : entries.findIndex((e) => e.key === move.dropOn);

  if (to < 0 || to >= entries.length || to === from) return null;

  const next = ids as string[];
  const reordered = [...next];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}
