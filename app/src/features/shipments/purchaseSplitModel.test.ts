import { describe, it, expect } from 'vitest';
import {
  OutgoingShipmentLoadingStateDto,
  OutgoingShipmentPurchaseInvoiceDto,
  OutgoingShipmentPurchaseInvoiceLineDto,
  ShipmentLoadingState,
} from 'src/generated/api-client';
import {
  purchasedTotal, rowSplit, capFor, columnTotals, columnsOf, claimAt, applyLineLocally, rowsOnInvoice,
  checkedBlocker, type LoadingStateName, type PurchasableRow,
} from './purchaseSplitModel';

const LEZAK = 'p-lezak';
const IPA = 'p-ipa';

function row(over: Partial<PurchasableRow> = {}): PurchasableRow {
  return { productId: LEZAK, orderQuantity: 0, fromInventory: 0, stockPurchaseQuantity: 0, ...over };
}

function invoice(sequence: number, id: string, lines: Array<[string, number]> = []) {
  const dto = new OutgoingShipmentPurchaseInvoiceDto();
  dto.id = id;
  dto.sequence = sequence;
  dto.lines = lines.map(([productId, quantity]) => {
    const line = new OutgoingShipmentPurchaseInvoiceLineDto();
    line.productId = productId;
    line.quantity = quantity;
    return line;
  });
  return dto;
}

describe('purchasedTotal', () => {
  it('counts ordered pieces the brewery supplies', () => {
    expect(purchasedTotal(row({ orderQuantity: 24 }))).toBe(24);
  });

  it('leaves out pieces taken from our own stock', () => {
    expect(purchasedTotal(row({ orderQuantity: 24, fromInventory: 4 }))).toBe(20);
  });

  it('is zero for a row sourced entirely from stock', () => {
    expect(purchasedTotal(row({ orderQuantity: 12, fromInventory: 12 }))).toBe(0);
  });

  it('adds goods bought for our own warehouse', () => {
    expect(purchasedTotal(row({ orderQuantity: 10, stockPurchaseQuantity: 6 }))).toBe(16);
  });
});

describe('columnsOf', () => {
  it('offers two columns even when nothing is stored', () => {
    // The table shows the split from the start; the second invoice is created on
    // the first write, not on load.
    expect(columnsOf([])).toEqual([{ sequence: 1 }, { sequence: 2 }]);
  });

  it('pads a single stored invoice up to two', () => {
    expect(columnsOf([invoice(1, 'i1')])).toEqual([{ sequence: 1, id: 'i1' }, { sequence: 2 }]);
  });

  it('keeps every stored invoice past the second', () => {
    expect(columnsOf([invoice(1, 'i1'), invoice(2, 'i2'), invoice(3, 'i3')])).toHaveLength(3);
  });

  it('orders by sequence, not by response order', () => {
    const shuffled = [invoice(3, 'i3'), invoice(1, 'i1'), invoice(2, 'i2')];
    expect(columnsOf(shuffled).map((c) => c.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('does not mutate its argument', () => {
    const invoices = [invoice(2, 'i2'), invoice(1, 'i1')];
    columnsOf(invoices);
    expect(invoices.map((i) => i.id)).toEqual(['i2', 'i1']);
  });
});

describe('claimAt', () => {
  const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 3], [LEZAK, 2], [IPA, 1]])];

  it('sums the lines of that product on that invoice', () => {
    expect(claimAt(invoices, 2, LEZAK)).toBe(5);
  });

  it('is zero for a column with no invoice behind it', () => {
    expect(claimAt(invoices, 3, LEZAK)).toBe(0);
  });
});

describe('rowSplit', () => {
  const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];

  it('shows the whole total as remainder when nothing is stored', () => {
    expect(rowSplit(row({ orderQuantity: 24 }), [])).toEqual([24, 0]);
  });

  it('puts everything unclaimed on the remainder', () => {
    expect(rowSplit(row({ orderQuantity: 24 }), invoices)).toEqual([20, 4]);
  });

  it('ignores claims on another product', () => {
    expect(rowSplit(row({ productId: IPA, orderQuantity: 6 }), invoices)).toEqual([6, 0]);
  });

  it('never shows a negative remainder when stored claims outrun the total', () => {
    // Reachable between a nakládka edit and the next write, which is when the
    // server re-clamps. Showing -2 would read as a data-entry error.
    expect(rowSplit(row({ orderQuantity: 2 }), invoices)).toEqual([0, 4]);
  });

  it('orders columns by sequence, not by response order', () => {
    const shuffled = [invoice(3, 'i3', [[LEZAK, 1]]), invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];
    expect(rowSplit(row({ orderQuantity: 10 }), shuffled)).toEqual([5, 4, 1]);
  });
});

describe('capFor', () => {
  const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]]), invoice(3, 'i3', [[LEZAK, 3]])];

  it('leaves out the column being edited', () => {
    expect(capFor(row({ orderQuantity: 12 }), invoices, 2)).toBe(9);
    expect(capFor(row({ orderQuantity: 12 }), invoices, 3)).toBe(8);
  });

  it('is the whole purchased total when nothing else claims the product', () => {
    expect(capFor(row({ productId: IPA, orderQuantity: 5 }), invoices, 2)).toBe(5);
  });

  it('is the whole purchased total on an unsplit shipment', () => {
    expect(capFor(row({ orderQuantity: 24 }), [], 2)).toBe(24);
  });

  it('is zero for a row bought entirely from our own stock', () => {
    expect(capFor(row({ orderQuantity: 5, fromInventory: 5 }), invoices, 2)).toBe(0);
  });

  it('never goes negative', () => {
    expect(capFor(row({ orderQuantity: 2 }), invoices, 2)).toBe(0);
  });
});

describe('applyLineLocally', () => {
  it('sets the quantity so the remainder recomputes at once', () => {
    const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];

    const next = applyLineLocally(invoices, { sequence: 2, productId: LEZAK, quantity: 9 });

    expect(claimAt(next, 2, LEZAK)).toBe(9);
    expect(rowSplit(row({ orderQuantity: 24 }), next)).toEqual([15, 9]);
  });

  it('materialises the columns it writes to, without inventing IDs', () => {
    const next = applyLineLocally([], { sequence: 2, productId: LEZAK, quantity: 4 });

    expect(next.map((i) => i.sequence)).toEqual([1, 2]);
    expect(next.every((i) => i.id === undefined)).toBe(true);
    expect(claimAt(next, 2, LEZAK)).toBe(4);
  });

  it('drops the line at zero rather than storing an empty claim', () => {
    const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4], [IPA, 2]])];

    const next = applyLineLocally(invoices, { sequence: 2, productId: LEZAK, quantity: 0 });

    expect(next[1].lines).toHaveLength(1);
    expect(claimAt(next, 2, IPA)).toBe(2);
  });

  it('leaves the other columns and products alone', () => {
    const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]]), invoice(3, 'i3', [[LEZAK, 2], [IPA, 5]])];

    const next = applyLineLocally(invoices, { sequence: 2, productId: LEZAK, quantity: 1 });

    expect(claimAt(next, 3, LEZAK)).toBe(2);
    expect(claimAt(next, 3, IPA)).toBe(5);
    expect(next.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('does not mutate the invoices it was given', () => {
    // The rollback snapshot is the original array; mutating it would make the
    // optimistic update unrecoverable.
    const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];

    applyLineLocally(invoices, { sequence: 2, productId: LEZAK, quantity: 9 });

    expect(claimAt(invoices, 2, LEZAK)).toBe(4);
  });
});

describe('rowsOnInvoice', () => {
  const lezak = row({ orderQuantity: 24 });
  const ipa = row({ productId: IPA, orderQuantity: 12 });
  const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];

  it('keeps the rows the remainder invoice still carries', () => {
    expect(rowsOnInvoice([lezak, ipa], invoices, 1)).toEqual([lezak, ipa]);
  });

  it('keeps only the rows with pieces on the chosen invoice', () => {
    expect(rowsOnInvoice([lezak, ipa], invoices, 2)).toEqual([lezak]);
  });

  it('drops a row whose whole quantity moved to a later invoice', () => {
    const all = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 24]])];
    expect(rowsOnInvoice([lezak, ipa], all, 1)).toEqual([ipa]);
  });

  it('drops rows bought entirely from our own stock', () => {
    const stockOnly = row({ orderQuantity: 6, fromInventory: 6 });
    expect(rowsOnInvoice([lezak, stockOnly], invoices, 1)).toEqual([lezak]);
  });

  it('returns everything for an invoice that no longer exists', () => {
    // Deleting an invoice while its tab is selected must not blank the table.
    expect(rowsOnInvoice([lezak, ipa], invoices, 7)).toEqual([lezak, ipa]);
  });
});

describe('columnTotals', () => {
  it('sums each column across rows', () => {
    const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4], [IPA, 1]])];
    const rows = [
      row({ orderQuantity: 24 }),
      row({ productId: IPA, orderQuantity: 12, fromInventory: 2 }),
    ];

    expect(columnTotals(rows, invoices)).toEqual([29, 5]);
  });

  it('has an entry per default column even with no rows and no invoices', () => {
    expect(columnTotals([], [])).toEqual([0, 0]);
  });
});

describe('checkedBlocker', () => {
  // The wire carries the enum's name while the generated enum is numeric - see loadingStateAt.
  function state(productId: string, sequence: number, value: LoadingStateName) {
    const dto = new OutgoingShipmentLoadingStateDto();
    dto.productId = productId;
    dto.sequence = sequence;
    dto.state = value as unknown as ShipmentLoadingState;
    return dto;
  }

  it('names the remainder column when that is what has been checked', () => {
    expect(checkedBlocker([state(LEZAK, 1, 'Checked')], LEZAK, 2)).toBe(1);
  });

  it('names the target column when it is the checked one', () => {
    expect(checkedBlocker([state(LEZAK, 2, 'Checked')], LEZAK, 2)).toBe(2);
  });

  it('prefers the remainder when both ends are checked', () => {
    const states = [state(LEZAK, 1, 'Checked'), state(LEZAK, 2, 'Checked')];
    expect(checkedBlocker(states, LEZAK, 2)).toBe(1);
  });

  it('blocks nothing while the counts are only dictated', () => {
    const states = [state(LEZAK, 1, 'Dictated'), state(LEZAK, 2, 'Dictated')];
    expect(checkedBlocker(states, LEZAK, 2)).toBeUndefined();
  });

  it('ignores a column the move does not touch', () => {
    expect(checkedBlocker([state(LEZAK, 3, 'Checked')], LEZAK, 2)).toBeUndefined();
  });

  it('ignores another product entirely', () => {
    expect(checkedBlocker([state(IPA, 1, 'Checked')], LEZAK, 2)).toBeUndefined();
  });
});
