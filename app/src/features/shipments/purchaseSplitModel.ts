// How a nakládka row's pieces divide across the invoices the brewery issues to us.
//
// The backend stores only exceptions: invoice 1 is the remainder and never holds
// lines. Everything on screen — the grey computed column, the per-column totals,
// the cap on an input — falls out of that one rule, so it lives here and is tested
// without a rendering harness.

import type { OutgoingShipmentPurchaseInvoiceDto } from 'src/generated/api-client';

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

/** Pieces of a product claimed by one invoice. Zero for the remainder invoice. */
export function claimOf(invoice: OutgoingShipmentPurchaseInvoiceDto, productId?: string): number {
  if (!productId) return 0;
  return (invoice.lines ?? [])
    .filter((l) => l.productId === productId)
    .reduce((sum, l) => sum + (l.quantity ?? 0), 0);
}

/**
 * What each invoice column shows for a row, in sequence order.
 *
 * The first entry is the remainder — what the later invoices leave — and is never
 * negative even if stored claims temporarily exceed the purchased total.
 */
export function rowSplit(
  row: PurchasableRow,
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
): number[] {
  const ordered = orderedInvoices(invoices);
  if (ordered.length === 0) return [];

  const claims = ordered.slice(1).map((inv) => claimOf(inv, row.productId));
  const remainder = purchasedTotal(row) - claims.reduce((a, b) => a + b, 0);

  return [Math.max(0, remainder), ...claims];
}

/**
 * Largest value the input for `invoice` may take on this row: everything the run
 * buys of the product, minus what the other line-holding invoices already claim.
 *
 * Enforced here as well as on the server — the server clamps silently, and a field
 * that accepts a number and then shows a different one reads as a bug.
 */
export function capFor(
  row: PurchasableRow,
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
  invoiceId: string,
): number {
  const claimedElsewhere = orderedInvoices(invoices)
    .slice(1)
    .filter((inv) => inv.id !== invoiceId)
    .reduce((sum, inv) => sum + claimOf(inv, row.productId), 0);

  return Math.max(0, purchasedTotal(row) - claimedElsewhere);
}

/** Column totals across every row, in the same order as {@link rowSplit}. */
export function columnTotals(
  rows: PurchasableRow[],
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
): number[] {
  const totals = new Array(orderedInvoices(invoices).length).fill(0) as number[];

  for (const row of rows) {
    rowSplit(row, invoices).forEach((value, index) => {
      totals[index] += value;
    });
  }

  return totals;
}

/**
 * Invoices by sequence. Sorted rather than trusted: the columns must line up with
 * the values `rowSplit` returns, and a reordered response would silently mislabel
 * every number in the table.
 */
export function orderedInvoices(
  invoices: OutgoingShipmentPurchaseInvoiceDto[],
): OutgoingShipmentPurchaseInvoiceDto[] {
  return [...invoices].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

/** Whether the split is worth showing at all — one invoice is not a split. */
export function isSplit(invoices: OutgoingShipmentPurchaseInvoiceDto[]): boolean {
  return invoices.length > 1;
}
