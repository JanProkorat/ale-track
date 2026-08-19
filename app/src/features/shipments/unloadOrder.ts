// What comes off the van, stop by stop, in the order the driver reaches them.
//
// The nakládka is the mirror image of this: it aggregates per product and sections
// by brewery, which is exactly right at the ramp where the pallet is packed brewery
// by brewery. On the road the question is the other one — "what comes off here" —
// so this shape is per stop and keeps each order's lines separate.
//
// Kept out of ShipmentDetail (already ~1720 lines) so the ordering can be checked
// without a rendering harness, same as nakladkaGrouping.ts.

import type { OutgoingShipmentStopDto, OutgoingShipmentStockPurchaseItemDto } from 'src/generated/api-client';
import { stopKindName } from 'src/lib/labels';
import { fmtLiters } from 'src/lib/format';
import { resolveDetailStopAddress } from './stopAddress';

/** What a line needs to build its chip and quantity — order items and stock
 * purchases both extend `OutgoingShipmentProductDto`, which has all of this. */
interface ChippableProduct {
  name?: string;
  platoDegree?: number;
  packageSize?: number;
  quantity?: number;
}

/**
 * Chip for a row of the loading list: degree and package size.
 *
 * No kind — the section heading above the row already says it. The degree is what
 * distinguishes two otherwise identically named beers on the pallet.
 *
 * Lives here (not in ShipmentDetail) so the unload list can build the exact same
 * chip without a second copy of the format drifting from the loading list's.
 */
export function platoSizeChipText(platoDegree: number | undefined, packageSize: number | undefined): string {
  return [
    platoDegree != null ? `${platoDegree}°` : '',
    packageSize != null ? fmtLiters(packageSize) : '',
  ].filter(Boolean).join(' · ');
}

/** One product to take off the van at a stop. */
export interface UnloadLine {
  name: string;
  /** Degree and package size, as on the loading list. */
  chip: string;
  quantity: number;
}

/** One stop on the driver's run. */
export interface UnloadStop {
  /** 1-based position on the route. Renumbered here: stored orders may have gaps. */
  seq: number;
  kind: 'order' | 'custom' | 'company';
  /** Client name, custom label, or the company name. */
  title: string;
  /** Resolved address line, when the stop has one. */
  subtitle?: string;
  note?: string;
  lines: UnloadLine[];
}

function lineFrom(product: ChippableProduct): UnloadLine {
  return {
    name: product.name ?? '—',
    chip: platoSizeChipText(product.platoDegree, product.packageSize),
    quantity: product.quantity ?? 0,
  };
}

/**
 * Shapes one stop, without its route position — {@link unloadOrder} assigns `seq`
 * once the stops are sorted.
 *
 * Company and Custom are checked first because they carry no `products` of their
 * own: Company's goods are the shipment's stock purchases (kept in sync with it by
 * the server), and Custom unloads nothing at all, only a note. Everything else is
 * an order stop, whose lines come straight off `stop.products` — already populated
 * from the live order while the run is still being planned, not only after loading.
 *
 * Supplier stops never reach here: {@link unloadOrder} drops them, so they must not be
 * fed to this function directly either — the order branch would title one from a
 * `clientName` it has never had.
 */
function shapeStop(
  stop: OutgoingShipmentStopDto,
  stockPurchases: OutgoingShipmentStockPurchaseItemDto[],
): Omit<UnloadStop, 'seq'> {
  const kind = stopKindName(stop.kind);

  if (kind === 'Company') {
    return {
      kind: 'company',
      title: stop.label ?? '—',
      lines: stockPurchases.map(lineFrom),
    };
  }

  if (kind === 'Custom') {
    return {
      kind: 'custom',
      title: stop.label ?? '—',
      note: stop.note,
      lines: [],
    };
  }

  return {
    kind: 'order',
    title: stop.clientName ?? '—',
    subtitle: resolveDetailStopAddress(stop).text,
    lines: (stop.products ?? []).map(lineFrom),
  };
}

/**
 * Shapes a shipment's stops into the driver's unload order: route order, numbered
 * from 1, each stop carrying only what comes off there.
 *
 * Two kinds of stop are left out, both because the van calls there to *collect*: every
 * supplier stop, and the warehouse when nothing is bought for stock — a run that only
 * fetches garage-sourced supplier goods gets that stop too, and it unloads nothing.
 * A custom stop with no lines does stay: its note is the reason the driver is there.
 *
 * Both are numbered before being dropped, so the numbers here stay the numbers on the
 * map pins and in Přehled zastávek (see stopOverview.ts) — the list skips a position
 * rather than renaming every stop after it.
 *
 * The start point is deliberately not among these either — nothing is unloaded there,
 * and giving it a `seq` would put it in the driver's count. The caller (Task 11's
 * component) takes it as a separate prop.
 */
export function unloadOrder(
  stops: OutgoingShipmentStopDto[],
  stockPurchases: OutgoingShipmentStockPurchaseItemDto[],
): UnloadStop[] {
  return stops
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((stop, index) => ({ stop, seq: index + 1 }))
    .filter(({ stop }) => stopKindName(stop.kind) !== 'Supplier')
    .map(({ stop, seq }) => ({ ...shapeStop(stop, stockPurchases), seq }))
    .filter((stop) => stop.kind !== 'company' || stop.lines.length > 0);
}
