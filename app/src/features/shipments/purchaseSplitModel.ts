// How a nakládka row's pieces divide across the invoices the brewery issues to us.
//
// The backend stores only exceptions: invoice 1 is the remainder and never holds
// lines, and an invoice exists only once something is written to it. The table
// nevertheless shows two columns from the start, so the model works in terms of
// *columns* — a column may or may not have an invoice behind it yet.

import {
  OutgoingShipmentPurchaseInvoiceDto,
  OutgoingShipmentPurchaseInvoiceLineDto,
  ShipmentLoadingState,
  type OutgoingShipmentLoadingStateDto,
} from 'src/generated/api-client';
import { loadingStateName } from 'src/lib/labels';

/** The table always offers this many invoice columns, split or not. */
export const DEFAULT_COLUMNS = 2;

/** One invoice column of the table. */
export interface PurchaseColumn {
  /** Position, from 1. What a line write addresses. */
  sequence: number;
  /** Public ID of the invoice behind it, absent until something is stored there. */
  id?: string;
}

/** The part of an aggregated nakládka row this model needs. */
export interface PurchasableRow {
  /** Product public ID — what a purchase-invoice line is keyed by. */
  productId?: string;
  /** Pieces ordered by clients on this run. */
  orderQuantity: number;
  /** Of `orderQuantity`, how many come off our own shelf. */
  fromInventory: number;
  /** Pieces bought for our own warehouse ("Zboží na sklad"). */
  stockPurchaseQuantity: number;
}

/**
 * Pieces of this row the run actually buys from a brewery.
 *
 * Pieces sourced from our own stock were bought on an earlier run and invoiced
 * then, so they cannot sit on this run's purchase invoice.
 */
export function purchasedTotal(row: PurchasableRow): number {
  return Math.max(0, row.orderQuantity - row.fromInventory) + row.stockPurchaseQuantity;
}

/**
 * The columns to render: every stored invoice, padded to {@link DEFAULT_COLUMNS}.
 *
 * Sorted by sequence rather than trusted in response order — the columns must line
 * up with the values {@link rowSplit} returns, and a reordered response would
 * silently mislabel every number in the table.
 */
export function columnsOf(invoices: OutgoingShipmentPurchaseInvoiceDto[]): PurchaseColumn[] {
  const stored: PurchaseColumn[] = [...invoices]
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((invoice, index) => ({ sequence: invoice.sequence ?? index + 1, id: invoice.id }));

  const columns = [...stored];
  for (let sequence = stored.length + 1; sequence <= DEFAULT_COLUMNS; sequence++) {
    columns.push({ sequence });
  }

  return columns;
}

/** Pieces of a product claimed by the invoice at `sequence`. Zero when none is stored. */
export function claimAt(
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  sequence: number,
  productId?: string,
): number {
  if (!productId) return 0;

  return invoices
    .filter((invoice) => invoice.sequence === sequence)
    .flatMap((invoice) => invoice.lines ?? [])
    .filter((line) => line.productId === productId)
    .reduce((sum, line) => sum + (line.quantity ?? 0), 0);
}

/**
 * What each column shows for a row, in column order.
 *
 * The first entry is the remainder — what the later invoices leave — and is never
 * negative even if stored claims temporarily exceed the purchased total.
 */
export function rowSplit(
  row: PurchasableRow,
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
): number[] {
  const columns = columnsOf(invoices);
  const claims = columns.slice(1).map((column) => claimAt(invoices, column.sequence, row.productId));
  const remainder = purchasedTotal(row) - claims.reduce((a, b) => a + b, 0);

  return [Math.max(0, remainder), ...claims];
}

/**
 * Largest value the input for one column may take on this row: everything the run
 * buys of the product, minus what the other columns already claim.
 *
 * Enforced here as well as on the server — the server clamps silently, and a field
 * that accepts a number and then shows a different one reads as a bug.
 */
export function capFor(
  row: PurchasableRow,
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  sequence: number,
): number {
  const claimedElsewhere = columnsOf(invoices)
    .slice(1)
    .filter((column) => column.sequence !== sequence)
    .reduce((sum, column) => sum + claimAt(invoices, column.sequence, row.productId), 0);

  return Math.max(0, purchasedTotal(row) - claimedElsewhere);
}

/**
 * The invoices as they will look once a line write lands, for updating the cache
 * before the server answers.
 *
 * Without this the typed column jumps immediately (its input is local state) while
 * the remainder waits for the refetch, so the row visibly fails to add up for a
 * moment. Mirrors what the server does, including materialising the invoices up to
 * `sequence`; those placeholders carry no ID until the real response arrives.
 */
export function applyLineLocally(
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  { sequence, productId, quantity }: { sequence: number; productId: string; quantity: number },
): OutgoingShipmentPurchaseInvoiceDto[] {
  const next = columnsOf(invoices).map((column) => {
    const stored = invoices.find((invoice) => invoice.sequence === column.sequence);
    const copy = new OutgoingShipmentPurchaseInvoiceDto();
    copy.id = stored?.id;
    copy.sequence = column.sequence;
    copy.lines = (stored?.lines ?? []).map((line) => {
      const lineCopy = new OutgoingShipmentPurchaseInvoiceLineDto();
      lineCopy.productId = line.productId;
      lineCopy.quantity = line.quantity;
      return lineCopy;
    });
    return copy;
  });

  // A column past the defaults can be written to only when it already exists, so
  // there is nothing to materialise beyond what columnsOf already padded.
  const target = next.find((invoice) => invoice.sequence === sequence);
  if (!target) return next;

  target.lines = (target.lines ?? []).filter((line) => line.productId !== productId);
  if (quantity > 0) {
    const line = new OutgoingShipmentPurchaseInvoiceLineDto();
    line.productId = productId;
    line.quantity = quantity;
    target.lines.push(line);
  }

  return next;
}

/**
 * Pieces of a row physically sitting in a column, which is not the same as the pieces
 * it bills there: the first column also carries whatever came out of our own garage,
 * because those are on no brewery invoice yet still have to be loaded.
 */
export function piecesInColumn(
  row: PurchasableRow,
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  sequence: number,
): number {
  const columns = columnsOf(invoices);
  const index = columns.findIndex((column) => column.sequence === sequence);
  if (index < 0) return 0;

  const billed = rowSplit(row, invoices)[index] ?? 0;
  return index === 0 ? billed + row.fromInventory : billed;
}

/**
 * How far a product has got in one column, as the enum's *name*.
 *
 * Names rather than the generated enum's numbers, because the API serialises enums
 * as strings on the wire while the generated TypeScript enum is numeric — comparing
 * a response value against `ShipmentLoadingState.Dictated` silently never matches.
 * `loadingStateName` resolves either representation; the rest of this module and the
 * components speak names only.
 */
export type LoadingStateName = 'NotLoaded' | 'Dictated' | 'Checked';

export function loadingStateAt(
  states: OutgoingShipmentLoadingStateDto[],
  productId: string | undefined,
  sequence: number,
): LoadingStateName {
  if (!productId) return 'NotLoaded';

  const found = states.find((s) => s.productId === productId && s.sequence === sequence);
  return loadingStateName(found?.state) as LoadingStateName;
}

/** The state a click moves to: none → dictated → checked → none. */
export function nextLoadingState(current: LoadingStateName): LoadingStateName {
  switch (current) {
    case 'NotLoaded': return 'Dictated';
    case 'Dictated': return 'Checked';
    default: return 'NotLoaded';
  }
}

/** The wire value for a state name — what a write sends back. */
export function loadingStateValue(name: LoadingStateName): ShipmentLoadingState {
  return ShipmentLoadingState[name];
}

/**
 * Loading progress over the whole list: how many (row, column) pairs carrying pieces
 * have been dictated, how many checked, and how many there are.
 *
 * Counted per pair rather than per product, because a product split across two
 * invoices is loaded twice — once for each pallet the driver is read out.
 */
export function loadingProgress(
  rows: PurchasableRow[],
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  states: OutgoingShipmentLoadingStateDto[],
  /** Restrict to one column; omit for the whole list. */
  onlySequence?: number,
): { total: number; dictated: number; checked: number } {
  let total = 0;
  let dictated = 0;
  let checked = 0;

  for (const row of rows) {
    for (const column of columnsOf(invoices)) {
      if (onlySequence !== undefined && column.sequence !== onlySequence) continue;
      if (piecesInColumn(row, invoices, column.sequence) <= 0) continue;

      total += 1;
      const state = loadingStateAt(states, row.productId, column.sequence);
      if (state !== 'NotLoaded') dictated += 1;
      if (state === 'Checked') checked += 1;
    }
  }

  return { total, dictated, checked };
}

/**
 * Rows carrying at least one piece on the invoice at `sequence` — the loading list
 * as that one invoice sees it.
 *
 * An unknown sequence returns everything rather than nothing: it means the invoice
 * was deleted while its tab was selected, and an empty table would read as "this
 * shipment carries nothing".
 */
export function rowsOnInvoice<T extends PurchasableRow>(
  rows: T[],
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  sequence: number,
): T[] {
  const index = columnsOf(invoices).findIndex((column) => column.sequence === sequence);
  if (index < 0) return rows;

  return rows.filter((row) => (rowSplit(row, invoices)[index] ?? 0) > 0);
}

/** Column totals across every row, in the same order as {@link rowSplit}. */
export function columnTotals(
  rows: PurchasableRow[],
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
): number[] {
  const totals = new Array(columnsOf(invoices).length).fill(0) as number[];

  for (const row of rows) {
    rowSplit(row, invoices).forEach((value, index) => {
      totals[index] += value;
    });
  }

  return totals;
}
