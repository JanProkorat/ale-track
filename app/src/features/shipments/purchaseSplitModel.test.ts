import { describe, it, expect } from 'vitest';
import { OutgoingShipmentPurchaseInvoiceDto, OutgoingShipmentPurchaseInvoiceLineDto } from 'src/generated/api-client';
import {
  purchasedTotal, rowSplit, capFor, columnTotals, isSplit, orderedInvoices,
  type PurchasableRow,
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

describe('rowSplit', () => {
  const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];

  it('is empty when there are no invoices', () => {
    expect(rowSplit(row({ orderQuantity: 24 }), [])).toEqual([]);
  });

  it('puts everything unclaimed on the remainder', () => {
    expect(rowSplit(row({ orderQuantity: 24 }), invoices)).toEqual([20, 4]);
  });

  it('ignores claims on another product', () => {
    expect(rowSplit(row({ productId: IPA, orderQuantity: 6 }), invoices)).toEqual([6, 0]);
  });

  it('sums several lines of the same product on one invoice', () => {
    const merged = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 3], [LEZAK, 2]])];
    expect(rowSplit(row({ orderQuantity: 10 }), merged)).toEqual([5, 5]);
  });

  it('never shows a negative remainder when stored claims outrun the total', () => {
    // Reachable between a nakládka edit and the next write, which is when the
    // server re-clamps. Showing -3 would read as a data-entry error.
    expect(rowSplit(row({ orderQuantity: 2 }), invoices)).toEqual([0, 4]);
  });

  it('orders columns by sequence, not by response order', () => {
    const shuffled = [invoice(3, 'i3', [[LEZAK, 1]]), invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];
    expect(rowSplit(row({ orderQuantity: 10 }), shuffled)).toEqual([5, 4, 1]);
  });
});

describe('capFor', () => {
  const invoices = [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]]), invoice(3, 'i3', [[LEZAK, 3]])];

  it('leaves out the invoice being edited', () => {
    expect(capFor(row({ orderQuantity: 12 }), invoices, 'i2')).toBe(9);
    expect(capFor(row({ orderQuantity: 12 }), invoices, 'i3')).toBe(8);
  });

  it('is the whole purchased total when nothing else claims the product', () => {
    expect(capFor(row({ productId: IPA, orderQuantity: 5 }), invoices, 'i2')).toBe(5);
  });

  it('is zero for a row bought entirely from our own stock', () => {
    expect(capFor(row({ orderQuantity: 5, fromInventory: 5 }), invoices, 'i2')).toBe(0);
  });

  it('never goes negative', () => {
    expect(capFor(row({ orderQuantity: 2 }), invoices, 'i2')).toBe(0);
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

  it('is all zeroes for no rows', () => {
    expect(columnTotals([], [invoice(1, 'i1'), invoice(2, 'i2')])).toEqual([0, 0]);
  });
});

describe('isSplit', () => {
  it('needs at least two invoices', () => {
    expect(isSplit([])).toBe(false);
    expect(isSplit([invoice(1, 'i1')])).toBe(false);
    expect(isSplit([invoice(1, 'i1'), invoice(2, 'i2')])).toBe(true);
  });
});

describe('orderedInvoices', () => {
  it('does not mutate its argument', () => {
    const invoices = [invoice(2, 'i2'), invoice(1, 'i1')];
    orderedInvoices(invoices);
    expect(invoices.map((i) => i.id)).toEqual(['i2', 'i1']);
  });
});
