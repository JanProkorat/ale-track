// Pure shaping logic for the Prodeje list: totals, the unpaid/overdue derivation and the
// segment filter. Kept out of the components (the shipmentInvoiceModel.ts precedent) so the
// stat strip, the filter and the overdue badge are testable without a rendering harness.

/** Sale filter segments offered above the list. */
export type SaleFilter = 'all' | 'draft' | 'unpaid' | 'completed';

/**
 * The narrow shape this module needs from a sale row. Structural on purpose: the generated
 * `SaleListItemDto` satisfies it, but the pure helpers stay usable (and testable) without
 * constructing a client DTO.
 */
export interface SaleRowLike {
  state?: string | number;
  payment?: string | number;
  dueDate?: string | Date;
  saleDate?: string | Date;
  totalQuantity?: number;
  totalPrice?: number;
}

/**
 * Enums arrive as strings on the wire but are typed numeric in the generated client — the same
 * caveat `permissionModel.ts` documents. Compare by name so both forms resolve.
 */
function enumName(value: string | number | undefined, members: readonly string[]): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'number' ? members[value] : String(value);
}

const SALE_STATES = ['Draft', 'Completed', 'AwaitingPayment'] as const;
const SALE_PAYMENTS = ['Cash', 'Invoice'] as const;

/** True when the sale is finished: handed over and, if invoiced, paid. */
export function isCompleted(sale: SaleRowLike): boolean {
  return enumName(sale.state, SALE_STATES) === 'Completed';
}

/** True when the goods have gone but the invoice has not been settled. */
export function isAwaitingPayment(sale: SaleRowLike): boolean {
  return enumName(sale.state, SALE_STATES) === 'AwaitingPayment';
}

/** True once the goods have left the shelf — awaiting payment or fully finished. */
export function hasLeftTheShelf(sale: SaleRowLike): boolean {
  return isCompleted(sale) || isAwaitingPayment(sale);
}

/** True when the sale is still a draft and has not touched inventory. */
export function isDraft(sale: SaleRowLike): boolean {
  return enumName(sale.state, SALE_STATES) === 'Draft';
}

/** True when the sale is invoiced. */
export function isInvoiced(sale: SaleRowLike): boolean {
  return enumName(sale.payment, SALE_PAYMENTS) === 'Invoice';
}

/**
 * True when money is still owed.
 *
 * This is now exactly the AwaitingPayment state rather than a conjunction of state, payment method
 * and a flag: the lifecycle is the single source of truth for whether a sale has been settled, so
 * there is nothing left to disagree with it. A draft is never unpaid — nothing has been handed over.
 */
export function isUnpaid(sale: SaleRowLike): boolean {
  return isAwaitingPayment(sale);
}

function toDate(value: string | Date | undefined): Date | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days a sale's invoice is past its due date, or 0 when nothing is owed.
 *
 * Both dates are floored to UTC midnight first, so the answer counts calendar days rather than
 * 24-hour spans and does not flip with the time of day the page happens to be open.
 */
export function overdueDays(sale: SaleRowLike, today: string | Date): number {
  if (!isUnpaid(sale)) return 0;

  const due = toDate(sale.dueDate);
  const now = toDate(today);
  if (!due || !now) return 0;

  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const days = Math.floor((nowUtc - dueUtc) / MS_PER_DAY);
  return days > 0 ? days : 0;
}

/** Applies a list segment filter. */
export function filterSales<T extends SaleRowLike>(sales: readonly T[], filter: SaleFilter): T[] {
  switch (filter) {
    case 'draft':
      return sales.filter(isDraft);
    case 'completed':
      return sales.filter(isCompleted);
    case 'unpaid':
      return sales.filter(isUnpaid);
    default:
      return [...sales];
  }
}

/** The shape this module needs from a sale's line. */
export interface SaleLineLike {
  id?: string;
  inventoryItemId?: string;
  name?: string;
  quantity?: number;
}

/**
 * Live stock keyed by inventory item id, built from the brewery-grouped list endpoint.
 *
 * Unlike the catalog's `sellableRows`, rows at zero are kept: a line whose stock has run out has to
 * read "skladem 0", not go missing and register as an unknown item.
 */
export function stockLevels(
  sections: { items?: { id?: string; quantity?: number }[] }[] | undefined
): Map<string, number> {
  const levels = new Map<string, number>();
  for (const section of sections ?? []) {
    for (const item of section.items ?? []) {
      if (item.id) levels.set(item.id, item.quantity ?? 0);
    }
  }
  return levels;
}

/** One line of a sale measured against what is currently on the shelf. */
export interface CompletionRow {
  key: string;
  name: string;
  /** Pieces the sale claims. */
  quantity: number;
  /** Pieces on the shelf now, or undefined when the stock row no longer exists. */
  before?: number;
  /** What would be left, or undefined when `before` is unknown. */
  after?: number;
  /** True when the shelf cannot cover this line. */
  short: boolean;
}

/**
 * Measures a draft's lines against live stock.
 *
 * A line whose stock row has vanished counts as short: it cannot be handed over, which is what the
 * backend concludes too (`InventoryItem is null` fails its guard). Callers must only trust the
 * verdict once the inventory query has actually succeeded — mid-fetch, every row looks absent.
 */
export function completionRows(
  lines: readonly SaleLineLike[] | undefined,
  levels: Map<string, number>
): CompletionRow[] {
  return (lines ?? []).map((line, index) => {
    const quantity = line.quantity ?? 0;
    const before = line.inventoryItemId ? levels.get(line.inventoryItemId) : undefined;

    return {
      key: line.id ?? line.inventoryItemId ?? `line-${index}`,
      name: line.name ?? '—',
      quantity,
      before,
      after: before === undefined ? undefined : before - quantity,
      short: before === undefined || before < quantity,
    };
  });
}

/** The lines the shelf cannot cover. */
export function shortRows(rows: readonly CompletionRow[]): CompletionRow[] {
  return rows.filter((row) => row.short);
}

/** Summary figures for the stat strip above the list. */
export interface SalesSummary {
  /** Completed sales in the given month. */
  completedThisMonth: number;
  /** Revenue of those sales, in CZK base. */
  revenueThisMonth: number;
  /** Drafts outstanding, in any month. */
  drafts: number;
  /** Unpaid invoices, in any month. */
  unpaid: number;
  /** Total owed across those unpaid invoices, in CZK base. */
  unpaidTotal: number;
}

/**
 * Builds the stat-strip figures.
 *
 * `month` is an ISO `YYYY-MM` prefix. Revenue counts completed sales only — a draft is not
 * income, and counting it would overstate the month the moment someone leaves a sale open.
 */
export function summariseSales(sales: readonly SaleRowLike[], month: string): SalesSummary {
  let completedThisMonth = 0;
  let revenueThisMonth = 0;
  let drafts = 0;
  let unpaid = 0;
  let unpaidTotal = 0;

  for (const sale of sales) {
    if (isDraft(sale)) drafts += 1;

    if (isCompleted(sale)) {
      const date = toDate(sale.saleDate);
      if (date && date.toISOString().slice(0, 7) === month) {
        completedThisMonth += 1;
        revenueThisMonth += sale.totalPrice ?? 0;
      }
    }

    if (isUnpaid(sale)) {
      unpaid += 1;
      unpaidTotal += sale.totalPrice ?? 0;
    }
  }

  return { completedThisMonth, revenueThisMonth, drafts, unpaid, unpaidTotal };
}
