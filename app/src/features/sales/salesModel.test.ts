import { describe, expect, it } from 'vitest';
import {
  completionRows,
  filterSales,
  hasLeftTheShelf,
  isAwaitingPayment,
  isUnpaid,
  overdueDays,
  shortRows,
  stockLevels,
  summariseSales,
  type SaleRowLike,
} from './salesModel';

const cashSale: SaleRowLike = {
  state: 'Completed',
  payment: 'Cash',
  saleDate: '2026-08-12',
  totalQuantity: 3,
  totalPrice: 3904,
};

/** Handed over on an invoice, money not in yet — the state that replaced the old IsPaid flag. */
const invoiceSale: SaleRowLike = {
  state: 'AwaitingPayment',
  payment: 'Invoice',
  dueDate: '2026-08-10',
  saleDate: '2026-08-08',
  totalQuantity: 5,
  totalPrice: 5300,
};

/** The same sale after the payment was confirmed. */
const paidInvoiceSale: SaleRowLike = { ...invoiceSale, state: 'Completed' };

const draftSale: SaleRowLike = {
  state: 'Draft',
  payment: 'Cash',
  saleDate: '2026-08-13',
  totalQuantity: 6,
  totalPrice: 5560,
};

describe('isUnpaid', () => {
  it('is true for an invoice awaiting payment', () => {
    expect(isUnpaid(invoiceSale)).toBe(true);
  });

  it('is false once the payment has been confirmed', () => {
    expect(isUnpaid(paidInvoiceSale)).toBe(false);
  });

  it('is false for a cash sale, which is paid at the counter', () => {
    expect(isUnpaid(cashSale)).toBe(false);
  });

  it('is false for a draft — nothing has been handed over to owe money for', () => {
    expect(isUnpaid({ ...invoiceSale, state: 'Draft' })).toBe(false);
  });

  it('resolves numeric enum members the same as their string names', () => {
    // The generated client types these numeric while the wire sends strings. AwaitingPayment is 2
    // because it was appended, so the numeric order does not follow the lifecycle.
    expect(isUnpaid({ ...invoiceSale, state: 2, payment: 1 })).toBe(true);
    expect(isUnpaid({ ...invoiceSale, state: 1, payment: 1 })).toBe(false);
    expect(isUnpaid({ ...invoiceSale, state: 0, payment: 1 })).toBe(false);
  });
});

describe('isAwaitingPayment / hasLeftTheShelf', () => {
  it('separates the two post-handover states', () => {
    expect(isAwaitingPayment(invoiceSale)).toBe(true);
    expect(isAwaitingPayment(paidInvoiceSale)).toBe(false);
  });

  it('treats both post-handover states as having moved stock', () => {
    expect(hasLeftTheShelf(invoiceSale)).toBe(true);
    expect(hasLeftTheShelf(paidInvoiceSale)).toBe(true);
    expect(hasLeftTheShelf(cashSale)).toBe(true);
    expect(hasLeftTheShelf(draftSale)).toBe(false);
  });
});

describe('overdueDays', () => {
  it('counts whole days past the due date', () => {
    expect(overdueDays(invoiceSale, '2026-08-13')).toBe(3);
  });

  it('is 0 on the due date itself', () => {
    expect(overdueDays(invoiceSale, '2026-08-10')).toBe(0);
  });

  it('is 0 before the due date', () => {
    expect(overdueDays(invoiceSale, '2026-08-09')).toBe(0);
  });

  it('ignores the time of day rather than counting 24-hour spans', () => {
    expect(overdueDays(invoiceSale, '2026-08-11T23:59:00Z')).toBe(1);
    expect(overdueDays(invoiceSale, '2026-08-11T00:01:00Z')).toBe(1);
  });

  it('is 0 for a settled invoice, however old', () => {
    expect(overdueDays(paidInvoiceSale, '2027-01-01')).toBe(0);
  });

  it('is 0 for a cash sale', () => {
    expect(overdueDays(cashSale, '2026-08-13')).toBe(0);
  });

  it('is 0 when no due date was recorded', () => {
    expect(overdueDays({ ...invoiceSale, dueDate: undefined }, '2026-08-13')).toBe(0);
  });
});

describe('filterSales', () => {
  const all = [cashSale, invoiceSale, draftSale];

  it('returns everything for the all segment', () => {
    expect(filterSales(all, 'all')).toHaveLength(3);
  });

  it('returns only drafts', () => {
    expect(filterSales(all, 'draft')).toEqual([draftSale]);
  });

  it('leaves an awaiting-payment sale out of the completed segment', () => {
    expect(filterSales(all, 'completed')).toEqual([cashSale]);
  });

  it('returns only unpaid invoices', () => {
    expect(filterSales(all, 'unpaid')).toEqual([invoiceSale]);
  });

  it('does not mutate the input', () => {
    const input = [...all];
    filterSales(input, 'draft');
    expect(input).toHaveLength(3);
  });
});

describe('stockLevels', () => {
  it('keeps rows at zero, unlike the catalog which drops them', () => {
    const levels = stockLevels([{ items: [{ id: 'a', quantity: 0 }, { id: 'b', quantity: 4 }] }]);

    // A line whose stock ran out must read "skladem 0", not go missing and count as unknown.
    expect(levels.get('a')).toBe(0);
    expect(levels.get('b')).toBe(4);
  });

  it('survives missing data', () => {
    expect(stockLevels(undefined).size).toBe(0);
  });
});

describe('completionRows', () => {
  const levels = stockLevels([{ items: [{ id: 'in-maz', quantity: 9 }, { id: 'in-out', quantity: 0 }] }]);

  it('reports what each line leaves behind', () => {
    const [row] = completionRows([{ id: 'l1', inventoryItemId: 'in-maz', name: 'Máz', quantity: 4 }], levels);

    expect(row.before).toBe(9);
    expect(row.after).toBe(5);
    expect(row.short).toBe(false);
  });

  it('marks a line the shelf cannot cover', () => {
    const [row] = completionRows([{ id: 'l1', inventoryItemId: 'in-out', name: 'Máz', quantity: 1 }], levels);

    expect(row.before).toBe(0);
    expect(row.short).toBe(true);
  });

  it('is not short when the line exactly empties the shelf', () => {
    const [row] = completionRows([{ id: 'l1', inventoryItemId: 'in-maz', name: 'Máz', quantity: 9 }], levels);

    expect(row.after).toBe(0);
    expect(row.short).toBe(false);
  });

  it('marks a line whose stock row has vanished, as the backend does', () => {
    const [row] = completionRows([{ id: 'l1', inventoryItemId: 'in-gone', name: 'Máz', quantity: 1 }], levels);

    expect(row.before).toBeUndefined();
    expect(row.after).toBeUndefined();
    expect(row.short).toBe(true);
  });

  it('marks a line that never had a stock row', () => {
    const [row] = completionRows([{ id: 'l1', name: 'Máz', quantity: 1 }], levels);
    expect(row.short).toBe(true);
  });

  it('falls back to a stable key when the line has no id', () => {
    const rows = completionRows([{ name: 'A', quantity: 1 }, { name: 'B', quantity: 1 }], levels);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });
});

describe('shortRows', () => {
  it('picks out only the lines that cannot be covered', () => {
    const levels = stockLevels([{ items: [{ id: 'ok', quantity: 5 }, { id: 'low', quantity: 1 }] }]);
    const rows = completionRows(
      [
        { id: 'l1', inventoryItemId: 'ok', name: 'OK', quantity: 2 },
        { id: 'l2', inventoryItemId: 'low', name: 'Low', quantity: 3 },
      ],
      levels
    );

    expect(shortRows(rows).map((r) => r.name)).toEqual(['Low']);
  });
});

describe('summariseSales', () => {
  it('counts completed sales and revenue for the given month only', () => {
    const summary = summariseSales([cashSale, paidInvoiceSale, draftSale], '2026-08');
    expect(summary.completedThisMonth).toBe(2);
    expect(summary.revenueThisMonth).toBe(3904 + 5300);
  });

  it('leaves an unsettled invoice out of the month revenue', () => {
    // The goods are gone but the money is not in, so counting it would overstate the month.
    const summary = summariseSales([cashSale, invoiceSale], '2026-08');
    expect(summary.completedThisMonth).toBe(1);
    expect(summary.revenueThisMonth).toBe(3904);
  });

  it('excludes completed sales from other months', () => {
    const summary = summariseSales([{ ...cashSale, saleDate: '2026-07-30' }], '2026-08');
    expect(summary.completedThisMonth).toBe(0);
    expect(summary.revenueThisMonth).toBe(0);
  });

  it('excludes drafts from revenue — an open sale is not income', () => {
    const summary = summariseSales([draftSale], '2026-08');
    expect(summary.revenueThisMonth).toBe(0);
    expect(summary.drafts).toBe(1);
  });

  it('totals what is still owed across unpaid invoices in any month', () => {
    const older = { ...invoiceSale, saleDate: '2026-06-01', totalPrice: 1000 };
    const summary = summariseSales([invoiceSale, older, cashSale], '2026-08');
    expect(summary.unpaid).toBe(2);
    expect(summary.unpaidTotal).toBe(6300);
  });
});
