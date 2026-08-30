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
  ClientLedgerEntryDto,
  OutgoingShipmentStopDto, OutgoingShipmentStockPurchaseItemDto, OutgoingShipmentSupplierGoodDto,
  ProductKind,
} from 'src/generated/api-client';
import { kindLabel, lineTravels, stopKindName } from 'src/lib/labels';
import { fmtLiters } from 'src/lib/format';
import {
  applyLedger, entriesForOrder, entriesForTarget, isOpen, planRow, type DecoratedRow,
} from 'src/features/clients/ledgerModel';
import { resolveDetailStopAddress } from './stopAddress';
import { formatStreetAddress } from 'src/features/clients/deliveryPlaceFormat';

/** What a line needs to build its chip and quantity — order items and stock
 * purchases both extend `OutgoingShipmentProductDto`, which has all of this. */
interface ChippableProduct {
  name?: string;
  /** Either wire shape: the numeric member (demo) or its name (real). */
  kind?: ProductKind | string | number;
  platoDegree?: number;
  packageSize?: number;
  quantity?: number;
  /** Present on a stop's order items; absent on the warehouse stop's stock purchases. */
  orderItemId?: string;
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
  /**
   * How a ledger entry points at this line — the order-item or supplier-good id. Absent on a
   * line no deviation can be recorded against (the warehouse stop's stock purchases).
   */
  key?: string;
  /**
   * What the ledger says about this line, when the caller passed one. The handover is the one
   * moment a plan and a reality exist side by side, and this list is the view of it.
   */
  diff?: DecoratedRow;
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
  /** The stop's own public id — what the "finished" mark is written against. */
  stopId?: string;
  /**
   * When the run finished with this stop, or undefined while it has not. Written by hand from
   * this list as the drivers ring in; nobody tracks the van.
   */
  completedAt?: Date;
  kind: 'order' | 'custom' | 'company' | 'supplier';
  /** Client name, custom label, supplier name, or the company name. */
  title: string;
  /** Resolved address line, when the stop has one. Without the address-kind tail: which of the
   *  client's addresses it is only matters where it can be changed, and that is the editor. */
  subtitle?: string;
  /** True when the stop's client has no resolvable address — nothing blocks saving such a
   *  client, so the shipment is where it has to be visible. */
  addressMissing: boolean;
  note?: string;
  /** The order behind a delivery stop, so the row can open it. */
  orderId?: string;
  /** Colour key for the numbered circle; only delivery stops are coloured per client. */
  clientId?: string;
  /** The supplier called at, on a pickup stop — what its opening hours are looked up by. */
  supplierId?: string;
  lines: UnloadLine[];
  /** Pieces coming off here, all lines together — the number to count the handover against. */
  totalQuantity: number;
  /**
   * How many of this stop's deviations are still open, for the badge beside the client's name.
   * Zero on a stop nothing was recorded against, and on every stop when no ledger was passed.
   */
  openChanges: number;
  /**
   * Whether this stop's Fakturace row is marked finished, which is what opens recording against
   * it. False on a stop with no order — there is no row to finish.
   */
  isInvoiceReady: boolean;
  /** The client whose ledger a deviation here belongs to, for the recording drawer. */
  clientIdForLedger?: string;
}

function lineFrom(product: ChippableProduct): UnloadLine {
  return {
    name: product.name ?? '—',
    chip: unloadChipText(product),
    quantity: product.quantity ?? 0,
    key: product.orderItemId,
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
    // The DTO's own id is the order's supplier-good line — the id a deviation points at.
    key: good.id,
  };
}

/**
 * One supplier good as the van collects it, at the supplier's own stop.
 *
 * The quantity is what is actually fetched here — the whole line minus whatever comes off our own
 * shelf, which is the same subtraction SupplierPickupStopReconciler makes to decide the stop
 * exists at all. A line wholly covered by the garage is left out by the caller.
 *
 * No `key`: nothing is recorded against a pickup. The deviation ledger belongs to a client's
 * order, and a supplier stop has none.
 */
function pickupLineFrom(good: OutgoingShipmentSupplierGoodDto): UnloadLine {
  return {
    name: good.name ?? '—',
    chip: ['Zboží dodavatele', good.size].filter(Boolean).join(' · '),
    quantity: (good.quantity ?? 0) - (good.quantityFromGarage ?? 0),
  };
}

/**
 * Shapes one stop, without its route position — {@link unloadOrder} assigns `seq`
 * once the stops are sorted.
 *
 * Company, Custom and Supplier are checked first because none of them carries `products`
 * of its own: Company's goods are the shipment's stock purchases (kept in sync with it by
 * the server), Custom unloads nothing at all but a note, and a Supplier stop is a pickup —
 * its lines are the run's supplier goods, matched by supplier. Everything else is an order
 * stop, whose lines come straight off `stop.products` — already populated from the live
 * order while the run is still being planned, not only after loading.
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
      addressMissing: false,
      lines: stockPurchases.map(lineFrom),
      openChanges: 0,
      isInvoiceReady: false,
    };
  }

  if (kind === 'Custom') {
    return {
      kind: 'custom',
      title: stop.label ?? '—',
      addressMissing: false,
      note: stop.note,
      lines: [],
      openChanges: 0,
      isInvoiceReady: false,
    };
  }

  if (kind === 'Supplier') {
    return {
      kind: 'supplier',
      // The stop's own label, not the live supplier name — the same choice stopOverview.ts
      // makes and for the same reason: it still reads correctly once the supplier is gone.
      title: stop.label ?? '—',
      subtitle: stop.supplierAddress ? formatStreetAddress(stop.supplierAddress) : undefined,
      // The warning is about a client with no delivery address. A supplier's address comes off
      // the registry, so its absence is that registry's business, not this list's.
      addressMissing: false,
      note: stop.note,
      supplierId: stop.supplierId,
      lines: supplierGoods
        .filter((g) => g.supplierId != null && g.supplierId === stop.supplierId)
        .map(pickupLineFrom)
        .filter((line) => line.quantity > 0),
      openChanges: 0,
      isInvoiceReady: false,
    };
  }

  const resolved = resolveDetailStopAddress(stop);
  return {
    kind: 'order',
    title: stop.clientName ?? '—',
    subtitle: resolved.addressText,
    addressMissing: resolved.addressText.trim().length === 0,
    orderId: stop.orderId,
    clientId: stop.clientId,
    // Filled in by decorate() once a ledger is in hand.
    openChanges: 0,
    isInvoiceReady: false,
    // The order's beer, then the supplier goods bought alongside it. Those are carried on the
    // run rather than on the stop, so they are matched back to it by order — a stop with no
    // order (a run may not have reconciled one yet) matches nothing rather than everything.
    // Bill-only lines are left out of both lists: nothing of them comes off the van, so a row
    // for them would read as something the driver has forgotten to hand over.
    lines: [
      ...(stop.products ?? []).filter((p) => lineTravels(p.lineKind)).map(lineFrom),
      ...(stop.orderId != null
        ? supplierGoods
          .filter((g) => g.orderId === stop.orderId && lineTravels(g.lineKind))
          .map(supplierLineFrom)
        : []),
    ],
  };
}

/**
 * Shapes a shipment's stops into the driver's unload order: route order, numbered
 * from 1, each stop carrying only what comes off there.
 *
 * Every stop the route has, whatever happens there. Supplier pickups and a warehouse stop
 * with nothing bought for stock used to be dropped for calling to collect rather than to
 * unload, which made the driver's list disagree with the route it belongs to — a stop absent
 * from the list reads as a stop that is not on the run. They are listed with what is collected
 * there instead, and a stop with nothing to hand over says so through the component's own
 * placeholder. A custom stop stays too: its note is the reason the driver is there.
 *
 * Numbered by route position, which is what the map pins and Přehled zastávek (see
 * stopOverview.ts) number by, so all three agree about which stop is "3".
 *
 * The start point is deliberately not among these either — nothing is unloaded there,
 * and giving it a `seq` would put it in the driver's count. The caller (Task 11's
 * component) takes it as a separate prop.
 */
export function unloadOrder(
  stops: OutgoingShipmentStopDto[],
  stockPurchases: OutgoingShipmentStockPurchaseItemDto[],
  supplierGoods: OutgoingShipmentSupplierGoodDto[],
  /**
   * The run's clients' ledgers, keyed by client id. Omitted before the deviations are loaded, and
   * on a run nobody has recorded anything against — the list then reads exactly as it did.
   */
  ledgerByClientId?: Map<string, ClientLedgerEntryDto[]>,
): UnloadStop[] {
  return stops
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((stop, index) => ({ stop, seq: index + 1 }))
    .map(({ stop, seq }) => {
      const shaped = shapeStop(stop, stockPurchases, supplierGoods);
      const decorated = decorate(shaped.lines, stop, ledgerByClientId);

      return {
        ...shaped,
        seq,
        stopId: stop.id,
        completedAt: stop.completedAt,
        lines: decorated.lines,
        // What actually comes off, so the number beside the client's name is the one the driver
        // counts against rather than the one the office planned.
        totalQuantity: decorated.lines.reduce((sum, l) => sum + (l.diff?.actualQuantity ?? l.quantity), 0),
        openChanges: decorated.openChanges,
        clientIdForLedger: stop.clientId,
        isInvoiceReady: stop.isInvoiceReady ?? false,
      };
    });
}

/**
 * Lays the stop's client's ledger over its lines, and appends what the plan never had.
 *
 * Goes through {@link applyLedger}, the same function the order detail uses, so the two views of
 * one handover cannot drift into showing different numbers.
 *
 * Returns and extra items are deliberately left out: they are not what comes off the pallet.
 * The driver takes the empties and the client signs for the loan — a different transaction at the
 * same doorstep — and they have their own cards on the shipment, which is where their diff goes.
 */
function decorate(
  lines: UnloadLine[],
  stop: OutgoingShipmentStopDto,
  ledgerByClientId?: Map<string, ClientLedgerEntryDto[]>,
): { lines: UnloadLine[]; openChanges: number } {
  const all = stop.clientId ? ledgerByClientId?.get(stop.clientId) : undefined;
  if (!all || !stop.orderId) return { lines, openChanges: 0 };

  const forOrder = entriesForOrder(all, stop.orderId);
  const productEntries = entriesForTarget(forOrder, 'ProductQuantity');
  const goodEntries = entriesForTarget(forOrder, 'SupplierGoodQuantity');

  const rows = applyLedger(
    lines.map((l) => planRow(l.key, l.name, l.quantity, l.chip)),
    [...productEntries, ...goodEntries],
  );

  const decorated = rows.map<UnloadLine>((row) => {
    const original = lines.find((l) => l.key === row.key);
    return {
      name: row.name,
      // An appended row has no planned line to borrow a chip from, so it says what it is instead.
      chip: original?.chip ?? 'Vzato na místě',
      quantity: row.quantity,
      key: row.key,
      diff: row,
    };
  });

  return { lines: decorated, openChanges: forOrder.filter(isOpen).length };
}
