import { describe, expect, it } from 'vitest';
import {
  InvoiceLineSourceKind,
  ProductKind,
  ShipmentInvoiceDto,
  ShipmentInvoiceLineDto,
  ShipmentInvoicesDto,
} from 'src/generated/api-client';
import {
  groupLines, groupValue, invoiceQuantity, invoiceValue, isCrossBilled, moveTargetOptions,
  originChips, partOrigin, partsByLikelihood, sectionTotals, toBands,
} from './shipmentInvoiceModel';

const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';
const ALE = 'prod-ale';
const LAGER = 'prod-lager';

function line(over: Partial<ShipmentInvoiceLineDto> = {}): ShipmentInvoiceLineDto {
  return new ShipmentInvoiceLineDto({
    id: `line-${Math.random().toString(36).slice(2, 8)}`,
    sourceKind: InvoiceLineSourceKind.OrderItem,
    sourceItemId: `item-${Math.random().toString(36).slice(2, 8)}`,
    productId: ALE,
    name: 'Albrecht 12°',
    kind: ProductKind.Keg,
    packageSize: 30,
    priceWithVat: 100,
    quantity: 1,
    orderingClientId: CLIENT_A,
    orderingClientName: 'Klient A',
    isFromStock: false,
    ...over,
  });
}

function invoice(over: Partial<ShipmentInvoiceDto> = {}): ShipmentInvoiceDto {
  return new ShipmentInvoiceDto({
    id: `inv-${Math.random().toString(36).slice(2, 8)}`,
    clientId: CLIENT_A,
    clientName: 'Klient A',
    sequence: 1,
    stopOrder: 1,
    lines: [],
    ...over,
  });
}

describe('groupLines', () => {
  it('merges the same product from several sources into one row', () => {
    const inv = invoice({
      lines: [
        line({ quantity: 6, sourceItemId: 'own' }),
        line({ quantity: 4, sourceItemId: 'foreign', orderingClientId: CLIENT_B, orderingClientName: 'Klient B' }),
      ],
    });

    const groups = groupLines(inv);

    expect(groups).toHaveLength(1);
    expect(groups[0].quantity).toBe(10);
    expect(groups[0].parts).toHaveLength(2);
  });

  it('keeps different products apart and preserves first-seen order', () => {
    const inv = invoice({
      lines: [
        line({ productId: LAGER, name: 'Lager 50°', quantity: 2 }),
        line({ productId: ALE, quantity: 3 }),
        line({ productId: LAGER, name: 'Lager 50°', quantity: 1 }),
      ],
    });

    const groups = groupLines(inv);

    expect(groups.map((g) => g.name)).toEqual(['Lager 50°', 'Albrecht 12°']);
    expect(groups[0].quantity).toBe(3);
    expect(groups[1].quantity).toBe(3);
  });

  it('groups product-less custom extras by name', () => {
    const inv = invoice({
      lines: [
        line({ productId: undefined, name: 'Vratné basy', quantity: 2, priceWithVat: undefined }),
        line({ productId: undefined, name: 'Vratné basy', quantity: 3, priceWithVat: undefined }),
        line({ productId: undefined, name: 'CO₂ bomba', quantity: 1, priceWithVat: undefined }),
      ],
    });

    const groups = groupLines(inv);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ name: 'Vratné basy', quantity: 5 });
  });

  it('values a row from its unit price and merged quantity', () => {
    const inv = invoice({ lines: [line({ quantity: 3, priceWithVat: 250 }), line({ quantity: 2, priceWithVat: 250 })] });

    expect(groupValue(groupLines(inv)[0])).toBe(1250);
  });
});

describe('isCrossBilled', () => {
  it('is true only when the orderer differs from the invoiced client', () => {
    const inv = invoice({ clientId: CLIENT_A });

    expect(isCrossBilled(inv, line({ orderingClientId: CLIENT_A }))).toBe(false);
    expect(isCrossBilled(inv, line({ orderingClientId: CLIENT_B }))).toBe(true);
  });

  it('does not claim cross-billing when the orderer is unknown', () => {
    expect(isCrossBilled(invoice(), line({ orderingClientId: undefined }))).toBe(false);
  });
});

describe('originChips', () => {
  it('reports the whole row as stock when every piece came from the warehouse', () => {
    const inv = invoice({ lines: [line({ quantity: 4, isFromStock: true })] });
    const chips = originChips(inv, groupLines(inv)[0]);

    expect(chips.stockQuantity).toBe(4);
    expect(chips.foreign).toEqual([]);
  });

  it('reports a partial stock quantity when the row mixes ordered and stock pieces', () => {
    // In the backend a dokládka is a separate ClientExtraItem, so it lands as its own
    // source on the same product row rather than as a field on the order item.
    const inv = invoice({
      lines: [
        line({ quantity: 10, sourceItemId: 'ordered' }),
        line({ quantity: 4, sourceItemId: 'stock', sourceKind: InvoiceLineSourceKind.ClientExtraItem, isFromStock: true }),
      ],
    });

    const group = groupLines(inv)[0];
    const chips = originChips(inv, group);

    expect(group.quantity).toBe(14);
    expect(chips.stockQuantity).toBe(4);
  });

  it('breaks cross-billed pieces down per ordering client', () => {
    const inv = invoice({
      clientId: CLIENT_A,
      lines: [
        line({ quantity: 5 }),
        line({ quantity: 2, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' }),
        line({ quantity: 1, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' }),
        line({ quantity: 3, orderingClientId: 'client-c', orderingClientName: 'Klient C' }),
      ],
    });

    const chips = originChips(inv, groupLines(inv)[0]);

    expect(chips.foreign).toEqual([
      { clientName: 'Klient B', quantity: 3 },
      { clientName: 'Klient C', quantity: 3 },
    ]);
  });

  it('does not double-count a stock line as cross-billed', () => {
    const inv = invoice({
      clientId: CLIENT_A,
      lines: [line({ quantity: 4, isFromStock: true, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' })],
    });

    const chips = originChips(inv, groupLines(inv)[0]);

    expect(chips.stockQuantity).toBe(4);
    expect(chips.foreign).toEqual([]);
  });
});

describe('toBands', () => {
  it('orders bands by the client route position and sorts invoices by sequence', () => {
    const data = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, sequence: 1, lines: [line({ quantity: 5, orderingClientId: CLIENT_B })] }),
        invoice({ clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, sequence: 2, lines: [line({ quantity: 2 })] }),
        invoice({ clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, sequence: 1, lines: [line({ quantity: 8 })] }),
      ],
    });

    const bands = toBands(data);

    expect(bands.map((b) => b.clientName)).toEqual(['Klient A', 'Klient B']);
    expect(bands[0].invoices.map((i) => i.sequence)).toEqual([1, 2]);
    expect(bands[0].quantity).toBe(10);
  });

  it('sorts a client with no stop last — they only hold cross-billed lines', () => {
    const data = new ShipmentInvoicesDto({
      invoices: [
        invoice({ clientId: 'ghost', clientName: 'Bývalý klient', stopOrder: undefined, lines: [line({ quantity: 3 })] }),
        invoice({ clientId: CLIENT_A, stopOrder: 1, lines: [line({ quantity: 1 })] }),
      ],
    });

    expect(toBands(data).map((b) => b.clientId)).toEqual([CLIENT_A, 'ghost']);
  });

  it('counts cross-billed lines per band', () => {
    const data = new ShipmentInvoicesDto({
      invoices: [
        invoice({
          clientId: CLIENT_A, stopOrder: 1,
          lines: [line({ quantity: 5 }), line({ quantity: 2, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' })],
        }),
      ],
    });

    expect(toBands(data)[0].crossBilled).toBe(1);
  });

  it('sums value from unit price times quantity', () => {
    const data = new ShipmentInvoicesDto({
      invoices: [invoice({ lines: [line({ quantity: 3, priceWithVat: 100 }), line({ productId: LAGER, quantity: 2, priceWithVat: 50 })] })],
    });

    expect(toBands(data)[0].value).toBe(400);
  });
});

describe('invoice totals', () => {
  it('sums quantity and value across lines', () => {
    const inv = invoice({ lines: [line({ quantity: 3, priceWithVat: 100 }), line({ quantity: 1, priceWithVat: 40 })] });

    expect(invoiceQuantity(inv)).toBe(4);
    expect(invoiceValue(inv)).toBe(340);
  });

  it('treats an empty invoice as zero rather than failing', () => {
    const inv = invoice({ lines: [] });

    expect(invoiceQuantity(inv)).toBe(0);
    expect(invoiceValue(inv)).toBe(0);
  });
});

describe('partOrigin', () => {
  it('names each origin the way the move dialog shows it', () => {
    const inv = invoice({ clientId: CLIENT_A });

    expect(partOrigin(inv, line({ isFromStock: true }))).toBe('ze skladu');
    expect(partOrigin(inv, line({ orderingClientId: CLIENT_B, orderingClientName: 'Klient B' })))
      .toBe('z obj. Klient B');
    expect(partOrigin(inv, line({ orderingClientId: CLIENT_A }))).toBe('z vlastní objednávky');
  });
});

describe('partsByLikelihood', () => {
  it('puts the biggest source first so the dialog preselects the likeliest', () => {
    const inv = invoice({
      lines: [line({ quantity: 2, sourceItemId: 'small' }), line({ quantity: 9, sourceItemId: 'big' })],
    });

    expect(partsByLikelihood(groupLines(inv)[0]).map((p) => p.sourceItemId)).toEqual(['big', 'small']);
  });

  it('does not mutate the group', () => {
    const inv = invoice({ lines: [line({ quantity: 1, sourceItemId: 'a' }), line({ quantity: 5, sourceItemId: 'b' })] });
    const group = groupLines(inv)[0];

    partsByLikelihood(group);

    expect(group.parts.map((p) => p.sourceItemId)).toEqual(['a', 'b']);
  });
});

describe('moveTargetOptions', () => {
  const from = invoice({ id: 'inv-from', clientId: CLIENT_A, sequence: 1, stopOrder: 1, lines: [line({ quantity: 5 })] });
  const otherOfA = invoice({ id: 'inv-a2', clientId: CLIENT_A, sequence: 2, stopOrder: 1 });
  const ofB = invoice({ id: 'inv-b1', clientId: CLIENT_B, clientName: 'Klient B', sequence: 1, stopOrder: 2, lines: [line({ quantity: 7, orderingClientId: CLIENT_B })] });
  const data = new ShipmentInvoicesDto({ invoices: [from, otherOfA, ofB] });
  const group = groupLines(from)[0];

  it('excludes the invoice being moved from', () => {
    expect(moveTargetOptions(data, from, group).map((o) => o.value)).not.toContain('inv:inv-from');
  });

  it('offers every other invoice plus a new one per client', () => {
    expect(moveTargetOptions(data, from, group).map((o) => o.value)).toEqual([
      'inv:inv-a2', 'new:client-a', 'inv:inv-b1', 'new:client-b',
    ]);
  });

  it('marks the client who ordered the pieces, so billing someone else is a visible choice', () => {
    const groups = moveTargetOptions(data, from, group);

    expect(groups.find((o) => o.value === 'inv:inv-a2')!.group).toBe('Klient A — objednavatel');
    expect(groups.find((o) => o.value === 'inv:inv-b1')!.group).toBe('Klient B');
  });

  it('numbers a new invoice after the client highest existing sequence', () => {
    const option = moveTargetOptions(data, from, group).find((o) => o.value === 'new:client-a')!;

    expect(option.label).toBe('+ nová faktura 3');
  });

  it('labels existing targets with their current piece count', () => {
    const option = moveTargetOptions(data, from, group).find((o) => o.value === 'inv:inv-b1')!;

    expect(option.label).toBe('Faktura 1 — 7 ks');
  });
});

describe('sectionTotals', () => {
  it('rolls the header numbers up across bands', () => {
    const data = new ShipmentInvoicesDto({
      invoices: [
        invoice({ clientId: CLIENT_A, stopOrder: 1, sequence: 1, lines: [line({ quantity: 6, priceWithVat: 100 })] }),
        invoice({ clientId: CLIENT_A, stopOrder: 1, sequence: 2, lines: [line({ quantity: 4, priceWithVat: 100 })] }),
        invoice({
          clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, sequence: 1,
          lines: [line({ quantity: 2, priceWithVat: 50, orderingClientId: CLIENT_A })],
        }),
      ],
    });

    expect(sectionTotals(data, toBands(data))).toEqual({
      invoices: 3,
      clients: 2,
      quantity: 12,
      value: 1100,
      crossBilled: 1,
    });
  });
});
