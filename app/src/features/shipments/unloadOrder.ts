// What comes off the van, stop by stop, in the order the driver reaches them.
//
// The nakládka is the mirror image of this: it aggregates per product and sections
// by brewery, which is exactly right at the ramp where the pallet is packed brewery
// by brewery. On the road the question is the other one — "what comes off here" —
// so this shape is per stop and keeps each order's lines separate.
//
// Kept out of ShipmentDetail (already ~1720 lines) so the ordering can be checked
// without a rendering harness, same as nakladkaGrouping.ts.

import type {
  OutgoingShipmentStopDto, OutgoingShipmentStockPurchaseItemDto, OutgoingShipmentSupplierGoodDto,
  ProductKind,
} from 'src/generated/api-client';
import { kindLabel, stopKindName } from 'src/lib/labels';
import { fmtLiters } from 'src/lib/format';
import { resolveDetailStopAddress } from './stopAddress';

/** What a line needs to build its chip and quantity — order items and stock
 * purchases both extend `OutgoingShipmentProductDto`, which has all of this. */
interface ChippableProduct {
  name?: string;
  /** Either wire shape: the numeric member (demo) or its name (real). */
  kind?: ProductKind | string | number;
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
  /** What kind of thing it is, then how big and how strong. See {@link unloadChipText}. */
  chip: string;
  quantity: number;
}

/**
 * The unload list's chip: kind first, then package size, then degree — 'Sud · 50 l · 12°'.
 *
 * Kind leads because it is what the driver is looking for: the same beer appears once per
 * package it is sold in, and three lines reading 'Svijanský Kníže' are told apart by the sud
 * and the basa, not by the degree they share. The loading list's own chip
 * ({@link platoSizeChipText}) stays as it is — there the section heading already says the kind.
 */
export function unloadChipText(product: ChippableProduct): string {
  return [
    kindLabel(product.kind),
    product.packageSize != null ? fmtLiters(product.packageSize) : '',
    product.platoDegree != null ? `${product.platoDegree}°` : '',
  ].filter(Boolean).join(' · ');
}

/** One stop on the driver's run. */
export interface UnloadStop {
  /** 1-based position on the route. Renumbered here: stored orders may have gaps. */
  seq: number;
  kind: 'order' | 'custom' | 'company';
  /** Client name, custom label, or the company name. */
  title: string;
  /** Resolved address line, when the stop has one. Without the address-kind tail: which of the
   *  client's addresses it is only matters where it can be changed, and that is the editor. */
  subtitle?: string;
  note?: string;
  /** The order behind a delivery stop, so the row can open it. */
  orderId?: string;
  /** Colour key for the numbered circle; only delivery stops are coloured per client. */
  clientId?: string;
  lines: UnloadLine[];
  /** Pieces coming off here, all lines together — the number to count the handover against. */
  totalQuantity: number;
}

function lineFrom(product: ChippableProduct): UnloadLine {
  return {
    name: product.name ?? '—',
    chip: unloadChipText(product),
    quantity: product.quantity ?? 0,
  };
}

/**
 * One supplier good handed over at its order's stop.
 *
 * The whole quantity, whichever way it was collected: the split between the garage and the
 * supplier decides where the van picks the pieces up, never how many the client gets.
 *
 * Named as supplier goods in the chip, because that is what tells a CO₂ bottle apart from the
 * beer around it — it has no kind, and its `size` is a free-text string ('10 kg') rather than
 * the volume the beer lines carry, so it is appended as it stands.
 */
function supplierLineFrom(good: OutgoingShipmentSupplierGoodDto): UnloadLine {
  return {
    name: good.name ?? '—',
    chip: ['Zboží dodavatele', good.size].filter(Boolean).join(' · '),
    quantity: good.quantity ?? 0,
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
  supplierGoods: OutgoingShipmentSupplierGoodDto[],
): Omit<UnloadStop, 'seq' | 'totalQuantity'> {
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
    subtitle: resolveDetailStopAddress(stop).addressText,
    orderId: stop.orderId,
    clientId: stop.clientId,
    // The order's beer, then the supplier goods bought alongside it. Those are carried on the
    // run rather than on the stop, so they are matched back to it by order — a stop with no
    // order (a run may not have reconciled one yet) matches nothing rather than everything.
    lines: [
      ...(stop.products ?? []).map(lineFrom),
      ...(stop.orderId != null
        ? supplierGoods.filter((g) => g.orderId === stop.orderId).map(supplierLineFrom)
        : []),
    ],
  };
}

/**
 * Shapes a shipment's stops into the driver's unload order: route order, numbered
 * from 1, each stop carrying only what comes off there.
 *
 * Two kinds of stop are left out, both because the van calls there to *collect*: every
 * supplier stop, and the warehouse when nothing is bought for stock — a run that only
 * fetches garage-sourced supplier goods gets that stop too, and it unloads nothing (the
 * goods themselves come off at the client's stop, which is where they are listed).
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
  supplierGoods: OutgoingShipmentSupplierGoodDto[],
): UnloadStop[] {
  return stops
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((stop, index) => ({ stop, seq: index + 1 }))
    .filter(({ stop }) => stopKindName(stop.kind) !== 'Supplier')
    .map(({ stop, seq }) => {
      const shaped = shapeStop(stop, stockPurchases, supplierGoods);
      return { ...shaped, seq, totalQuantity: shaped.lines.reduce((sum, l) => sum + l.quantity, 0) };
    })
    .filter((stop) => stop.kind !== 'company' || stop.lines.length > 0);
}
