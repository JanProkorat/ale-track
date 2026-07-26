// How a nakládka row's pieces divide across the invoices the brewery issues to us.
//
// The backend stores only exceptions: invoice 1 is the remainder and never holds
// lines, and an invoice exists only once something is written to it. The table
// nevertheless shows two columns from the start, so the model works in terms of
// *columns* — a column may or may not have an invoice behind it yet.

import {
  OutgoingShipmentPurchaseInvoiceDto,
  OutgoingShipmentPurchaseInvoiceLineDto,
} from 'src/generated/api-client';

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
