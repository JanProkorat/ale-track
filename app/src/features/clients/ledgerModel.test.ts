import { describe, expect, it } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import {
  applyLedger,
  deliveredEntryFor,
  deviationText,
  doorSideAdditions,
  entryLineKey,
  billablePieces,
  doorSideGoods,
  entryDeviation,
  entryDisplayName,
  entryTooltip,
  groupByOrder,
  isBillable,
  isExtraSettleable,
  isGoodSettleable,
  isReturnSettleable,
  ledgerNoteText,
  ledgerTodo,
  isAssigned,
  moneySummary,
  openEntries,
  type PlanRow,
} from './ledgerModel';

/** An entry as the wire delivers it: a class instance, with the target as its enum member. */
function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: crypto.randomUUID(),
    target: ClientLedgerEntryTarget.ProductQuantity,
    requiresFollowUp: false,
    createdAt: '2026-08-24T10:00:00Z',
    ...over,
  });
}

const ITEM_A = '11111111-1111-1111-1111-111111111111';
const ITEM_B = '22222222-2222-2222-2222-222222222222';
const PRODUCT = '33333333-3333-3333-3333-333333333333';
const ORDER_CARRYING = '99999999-9999-9999-9999-999999999999';

function plan(...rows: Array<[string, string, number]>): PlanRow[] {
  return rows.map(([key, name, quantity]) => ({ key, name, quantity }));
}

describe('applyLedger', () => {
  it('leaves a line with no entry alone', () => {
    const rows = applyLedger(plan([ITEM_A, 'Ležák 12', 10]), []);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'unchanged', plannedQuantity: 10, actualQuantity: 10 });
    expect(rows[0].entry).toBeUndefined();
  });

  it('marks a short delivery as changed and keeps both numbers', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 10]),
      [entry({ orderItemId: ITEM_A, plannedQuantity: 10, actualQuantity: 7 })],
    );

    expect(rows[0]).toMatchObject({ status: 'changed', plannedQuantity: 10, actualQuantity: 7 });
    expect(deviationText(rows[0])).toBe('Nevyloženo 3 ks');
  });

  it('marks an over-delivery as changed', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 10]),
      [entry({ orderItemId: ITEM_A, plannedQuantity: 10, actualQuantity: 12 })],
    );

    expect(rows[0]).toMatchObject({ status: 'changed', actualQuantity: 12 });
    expect(deviationText(rows[0])).toBe('Navíc 2 ks');
  });

  it('marks a line nothing arrived on as removed', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 10]),
      [entry({ orderItemId: ITEM_A, plannedQuantity: 10, actualQuantity: 0 })],
    );

    expect(rows[0].status).toBe('removed');
    expect(deviationText(rows[0])).toBe('Nevyloženo');
  });

  // The commonest surprise of the whole feature: it has no planned row to hang off, so the
  // model has to append one rather than only decorating what it was given.
  it('appends a row for a product taken at the door', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 10]),
      [entry({ productId: PRODUCT, productName: 'Světlé 10', plannedQuantity: 0, actualQuantity: 4 })],
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      name: 'Světlé 10',
      status: 'added',
      plannedQuantity: 0,
      actualQuantity: 4,
    });
    expect(deviationText(rows[1])).toBe('Přidáno extra');
  });

  it('appends a row for empties handed back against an order that planned none', () => {
    const rows = applyLedger(
      [],
      [entry({
        target: ClientLedgerEntryTarget.ReturnQuantity,
        lineName: 'Basy prázdných',
        plannedQuantity: 0,
        actualQuantity: 4,
      })],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Basy prázdných', status: 'added', actualQuantity: 4 });
  });

  it('decorates only the line an entry is about', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 10], [ITEM_B, 'Světlé 10', 4]),
      [entry({ orderItemId: ITEM_A, plannedQuantity: 10, actualQuantity: 7 })],
    );

    expect(rows[0].status).toBe('changed');
    expect(rows[1].status).toBe('unchanged');
  });

  // The plan the form measured against can exceed the order's own quantity — a top-up at the
  // ramp — so the delta is what carries over, not the entry's actual.
  it('applies the delta to the row rather than taking the entry actual wholesale', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 4]),
      [entry({ orderItemId: ITEM_A, plannedQuantity: 6, actualQuantity: 5 })],
    );

    expect(rows[0]).toMatchObject({ plannedQuantity: 4, actualQuantity: 3 });
  });

  it('never renders a negative quantity', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 2]),
      [entry({ orderItemId: ITEM_A, plannedQuantity: 10, actualQuantity: 0 })],
    );

    expect(rows[0].actualQuantity).toBe(0);
  });

  // Filtering the display by resolution would put the plan back on screen the moment somebody
  // squared the debt — and the same mistake on the invoice would bill the pieces twice.
  it('keeps showing a settled deviation', () => {
    const rows = applyLedger(
      plan([ITEM_A, 'Ležák 12', 10]),
      [entry({
        orderItemId: ITEM_A,
        plannedQuantity: 10,
        actualQuantity: 7,
        resolvedAt: new Date('2026-08-26T09:00:00Z'),
      })],
    );

    expect(rows[0]).toMatchObject({ status: 'changed', actualQuantity: 7 });
  });

  it('ignores money, address and note entries', () => {
    const rows = applyLedger(plan([ITEM_A, 'Ležák 12', 10]), [
      entry({ target: ClientLedgerEntryTarget.Money, amount: 2400 }),
      entry({ target: ClientLedgerEntryTarget.DeliveryAddress, plannedText: 'A', actualText: 'B' }),
      entry({ target: ClientLedgerEntryTarget.Other, note: 'volal, ozve se' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('unchanged');
  });

  it('drops an appended entry that records no deviation at all', () => {
    const rows = applyLedger(
      [],
      [entry({ productId: PRODUCT, productName: 'Světlé 10', plannedQuantity: 4, actualQuantity: 4 })],
    );

    expect(rows).toHaveLength(0);
  });
});

describe('deliveredEntryFor', () => {
  // A line can carry a settled entry and a newer open one; counting both would double the
  // shortfall, so exactly one wins and it is the open one.
  // The settled one is deliberately the *newer* row here, so only the open-first rule can pick
  // the right entry — a date-only sort would take the settled one and pass by accident.
  it('prefers the open entry over a settled one, even a newer settled one', () => {
    const settled = entry({
      orderItemId: ITEM_A,
      plannedQuantity: 10,
      actualQuantity: 7,
      resolvedAt: new Date('2026-08-26T09:00:00Z'),
      createdAt: new Date('2026-08-26T08:00:00Z'),
    });
    const open = entry({
      orderItemId: ITEM_A,
      plannedQuantity: 10,
      actualQuantity: 4,
      createdAt: new Date('2026-08-24T12:00:00Z'),
    });

    expect(deliveredEntryFor([settled, open], ITEM_A)?.actualQuantity).toBe(4);
  });

  it('falls back to the most recent settled entry when nothing is open', () => {
    const older = entry({
      orderItemId: ITEM_A,
      actualQuantity: 7,
      plannedQuantity: 10,
      resolvedAt: new Date('2026-08-20T09:00:00Z'),
      createdAt: new Date('2026-08-18T08:00:00Z'),
    });
    const newer = entry({
      orderItemId: ITEM_A,
      actualQuantity: 5,
      plannedQuantity: 10,
      resolvedAt: new Date('2026-08-22T09:00:00Z'),
      createdAt: new Date('2026-08-21T08:00:00Z'),
    });

    expect(deliveredEntryFor([older, newer], ITEM_A)?.actualQuantity).toBe(5);
  });
});

describe('entryLineKey', () => {
  it('keys a planned line on its own id', () => {
    expect(entryLineKey(entry({ orderItemId: ITEM_A, productId: PRODUCT }))).toBe(ITEM_A);
  });

  it('keys a door-side product on the product', () => {
    expect(entryLineKey(entry({ productId: PRODUCT }))).toBe(`product:${PRODUCT}`);
  });

  it('keys a free-text line on its name, case- and space-insensitively', () => {
    expect(entryLineKey(entry({ lineName: '  Basy Prázdných ' })))
      .toBe(entryLineKey(entry({ lineName: 'basy prázdných' })));
  });
});

describe('moneySummary', () => {
  // "You owe me 500 and I owe you 500" is two things to settle, not nothing.
  it('sums the two directions separately rather than netting them', () => {
    const summary = moneySummary([
      entry({ target: ClientLedgerEntryTarget.Money, amount: 500 }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: -500 }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: 240 }),
    ]);

    expect(summary).toEqual({ owedByClient: 740, owedToClient: 500 });
  });

  it('is zero in both directions with no money entries', () => {
    expect(moneySummary([])).toEqual({ owedByClient: 0, owedToClient: 0 });
  });
});

describe('open points', () => {
  it('counts an entry an order is carrying as still open', () => {
    const assigned = entry({ resolvedByOrderId: '44444444-4444-4444-4444-444444444444' });

    expect(openEntries([assigned])).toHaveLength(1);
    expect(isAssigned(assigned)).toBe(true);
  });

  it('leaves settled entries out', () => {
    expect(openEntries([entry({ resolvedAt: new Date('2026-08-26T09:00:00Z') })])).toHaveLength(0);
  });
});

// What the recording form may offer to correct: an addition it made itself, keyed by product
// because there is no order line to key on.
describe('doorSideAdditions', () => {
  const added = () => entry({ productId: PRODUCT, productName: 'Světlé 10', plannedQuantity: 0, actualQuantity: 4 });

  it('finds a product taken at the door', () => {
    expect(doorSideAdditions([added()])).toHaveLength(1);
  });

  it('leaves a deviation on a planned line to its own row', () => {
    expect(doorSideAdditions([
      entry({ orderItemId: ITEM_A, productId: PRODUCT, plannedQuantity: 10, actualQuantity: 7 }),
    ])).toHaveLength(0);
  });

  // Re-saving one of these would open a second row beside it rather than rewrite it.
  it('leaves a settled one out', () => {
    expect(doorSideAdditions([
      entry({ productId: PRODUCT, plannedQuantity: 0, actualQuantity: 4, resolvedAt: new Date('2026-08-26T09:00:00Z') }),
    ])).toHaveLength(0);
  });

  it('ignores an added return, which is keyed by name and belongs to its own table', () => {
    expect(doorSideAdditions([
      entry({ target: ClientLedgerEntryTarget.ReturnQuantity, lineName: 'Basy', plannedQuantity: 0, actualQuantity: 4 }),
    ])).toHaveLength(0);
  });

  it('ignores money, which has no quantity at all', () => {
    expect(doorSideAdditions([
      entry({ target: ClientLedgerEntryTarget.Money, amount: 2400 }),
    ])).toHaveLength(0);
  });

  it('ignores an entry that records no change', () => {
    expect(doorSideAdditions([
      entry({ productId: PRODUCT, plannedQuantity: 0, actualQuantity: 0 }),
    ])).toHaveLength(0);
  });
});

describe('entryTooltip', () => {
  it('carries the note, the author and the date', () => {
    const text = entryTooltip(entry({ note: 'řidič nechal paletu', createdByUserName: 'jan' }));

    expect(text).toContain('řidič nechal paletu');
    expect(text).toContain('jan');
    expect(text).toContain('24');
  });

  it('is undefined without an entry', () => {
    expect(entryTooltip(undefined)).toBeUndefined();
  });
});

describe('groupByOrder', () => {
  const ORDER_A = '44444444-4444-4444-4444-444444444444';
  const ORDER_B = '55555555-5555-5555-5555-555555555555';

  it('puts the entries of one order together, newest first inside the group', () => {
    const groups = groupByOrder([
      entry({ orderId: ORDER_A, note: 'starsi', createdAt: new Date('2026-08-24T10:00:00Z') }),
      entry({ orderId: ORDER_B, note: 'jina objednavka', createdAt: new Date('2026-08-23T10:00:00Z') }),
      entry({ orderId: ORDER_A, note: 'novejsi', createdAt: new Date('2026-08-25T10:00:00Z') }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].orderId).toBe(ORDER_A);
    expect(groups[0].entries.map((e) => e.note)).toEqual(['novejsi', 'starsi']);
  });

  // Groups follow the same newest-first rule the rows keep among themselves.
  it('leads with the order whose newest entry is newest', () => {
    const groups = groupByOrder([
      entry({ orderId: ORDER_A, createdAt: new Date('2026-08-20T10:00:00Z') }),
      entry({ orderId: ORDER_B, createdAt: new Date('2026-08-26T10:00:00Z') }),
    ]);

    expect(groups.map((g) => g.orderId)).toEqual([ORDER_B, ORDER_A]);
  });

  // A standalone debt has no order to group under, and sorts by date with everything else.
  it('collects the entries with no order into one group of their own', () => {
    const groups = groupByOrder([
      entry({ orderId: ORDER_A, createdAt: new Date('2026-08-26T10:00:00Z') }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: 500, createdAt: new Date('2026-08-27T10:00:00Z') }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: 200, createdAt: new Date('2026-08-25T10:00:00Z') }),
    ]);

    expect(groups.map((g) => g.orderId)).toEqual([undefined, ORDER_A]);
    expect(groups[0].entries).toHaveLength(2);
  });

  it('is empty for an empty ledger', () => {
    expect(groupByOrder([])).toEqual([]);
  });

  it('dates the group from the run carrying the order', () => {
    const deliveryDate = new Date('2026-08-26T06:30:00Z');
    const groups = groupByOrder([
      entry({ orderId: ORDER_A, createdAt: new Date('2026-08-25T10:00:00Z') }),
      entry({ orderId: ORDER_A, shipmentDeliveryDate: deliveryDate, createdAt: new Date('2026-08-24T10:00:00Z') }),
    ]);

    expect(groups[0].shipmentDeliveryDate).toEqual(deliveryDate);
  });

  it('leaves the date off a group no shipment carries', () => {
    expect(groupByOrder([entry({ orderId: ORDER_A })])[0].shipmentDeliveryDate).toBeUndefined();
  });
});

describe('ledgerTodo', () => {
  const money = (v: number) => `${v} Kč`;

  it('sends a short delivery to the cart', () => {
    const todo = ledgerTodo(entry({ productId: PRODUCT, plannedQuantity: 10, actualQuantity: 7 }), money);

    expect(todo).toEqual({ text: 'dovézt 3 ks', action: 'order' });
  });

  // The pieces are already with the client, so what is left is money — which the next order can
  // carry as a bill-only line, billed and never loaded.
  it('turns an over-delivery into something to bill', () => {
    const todo = ledgerTodo(entry({ productId: PRODUCT, plannedQuantity: 3, actualQuantity: 4 }), money);

    expect(todo).toEqual({ text: 'doúčtovat 1 ks', action: 'bill' });
  });

  // Nothing to price means nothing an order can bill for it.
  it('offers no billing action without a product or a good', () => {
    const todo = ledgerTodo(entry({ lineName: 'Něco', plannedQuantity: 3, actualQuantity: 4 }), money);

    expect(todo).toEqual({ text: 'doúčtovat 1 ks', action: 'none' });
  });

  // A supplier good or a custom extra has no product the cart can price.
  it('states the shortfall but offers no cart action without a product', () => {
    const todo = ledgerTodo(entry({ plannedQuantity: 5, actualQuantity: 2 }), money);

    expect(todo).toEqual({ text: 'dovézt 3 ks', action: 'none' });
  });

  it('sends unreturned empties to the vratky', () => {
    const todo = ledgerTodo(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      lineName: 'Basy',
      plannedQuantity: 5,
      actualQuantity: 4,
    }), money);

    expect(todo).toEqual({ text: 'vyzvednout 1 ks obalů', action: 'returns' });
  });

  // Empties run the other way from goods: too many back and we are holding their deposit.
  it('reads extra empties as a deposit to give back', () => {
    const todo = ledgerTodo(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      lineName: 'Basy',
      plannedQuantity: 0,
      actualQuantity: 2,
    }), money);

    expect(todo).toEqual({ text: 'vrátit zálohu za 2 ks', action: 'none' });
  });

  it('reads money in both directions', () => {
    expect(ledgerTodo(entry({ target: ClientLedgerEntryTarget.Money, amount: 100 }), money))
      .toEqual({ text: 'vybrat 100 Kč', action: 'none' });
    expect(ledgerTodo(entry({ target: ClientLedgerEntryTarget.Money, amount: -100 }), money))
      .toEqual({ text: 'vrátit 100 Kč', action: 'none' });
  });

  it('falls back to acknowledging a note', () => {
    expect(ledgerTodo(entry({ target: ClientLedgerEntryTarget.Other, note: 'řidič nechal paletu' }), money))
      .toEqual({ text: 'vzít na vědomí', action: 'none' });
  });
});

describe('entryDeviation', () => {
  it('words a shortfall of goods', () => {
    expect(entryDeviation(entry({ plannedQuantity: 10, actualQuantity: 7 }))).toBe('Nevyloženo 3 ks');
  });

  // The same numbers on empties mean the opposite thing.
  it('words a shortfall of empties as unreturned', () => {
    expect(entryDeviation(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      plannedQuantity: 5,
      actualQuantity: 4,
    }))).toBe('Nevráceno 1 ks');
  });

  it('is undefined for money, which has no line', () => {
    expect(entryDeviation(entry({ target: ClientLedgerEntryTarget.Money, amount: 100 }))).toBeUndefined();
  });
});

describe('isReturnSettleable', () => {
  it('accepts empties the client kept', () => {
    expect(isReturnSettleable(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      plannedQuantity: 5,
      actualQuantity: 4,
    }))).toBe(true);
  });

  it('rejects empties handed back in excess', () => {
    expect(isReturnSettleable(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      plannedQuantity: 0,
      actualQuantity: 2,
    }))).toBe(false);
  });

  it('rejects one another order is already collecting', () => {
    expect(isReturnSettleable(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      plannedQuantity: 5,
      actualQuantity: 4,
      resolvedByOrderId: '66666666-6666-6666-6666-666666666666',
    }))).toBe(false);
  });

  it('rejects a product shortfall, which belongs in the cart', () => {
    expect(isReturnSettleable(entry({ productId: PRODUCT, plannedQuantity: 10, actualQuantity: 7 }))).toBe(false);
  });
});

describe('supplier goods on the ledger', () => {
  const GOOD = '77777777-7777-7777-7777-777777777777';

  const goodEntry = (over: Partial<ClientLedgerEntryDto> = {}) => entry({
    target: ClientLedgerEntryTarget.SupplierGoodQuantity,
    supplierGoodId: GOOD,
    goodName: 'CO₂ láhev',
    plannedQuantity: 3,
    actualQuantity: 1,
    ...over,
  });

  // The gap this closes: a good could only be pinned to an order line, so one handed over
  // unplanned had nowhere to go and the drawer offered brewery products only.
  it('sends a good that is still owed to the order own goods lines', () => {
    const todo = ledgerTodo(goodEntry(), (v) => `${v} Kč`);

    expect(todo).toEqual({ text: 'dovézt 2 ks', action: 'goods' });
    expect(isGoodSettleable(goodEntry())).toBe(true);
  });

  it('offers no goods action without a good behind it', () => {
    expect(isGoodSettleable(goodEntry({ supplierGoodId: undefined }))).toBe(false);
  });

  it('offers no goods action on one another order is already bringing', () => {
    expect(isGoodSettleable(goodEntry({ resolvedByOrderId: ORDER_CARRYING }))).toBe(false);
  });

  it('names the row from the good, which is the only name it has', () => {
    expect(entryDisplayName(goodEntry())).toBe('CO₂ láhev');
  });

  it('keys a good with no order line by the good', () => {
    expect(entryLineKey(goodEntry())).toBe(`good:${GOOD}`);
  });

  it('collects the goods taken at the door', () => {
    const taken = goodEntry({ plannedQuantity: 0, actualQuantity: 2 });

    expect(doorSideGoods([taken, entry({ productId: PRODUCT })])).toEqual([taken]);
  });

  it('leaves out a good the order planned, which is an over-delivery on its own line', () => {
    const planned = goodEntry({ supplierGoodItemId: '88888888-8888-8888-8888-888888888888' });

    expect(doorSideGoods([planned])).toHaveLength(0);
  });
});

describe('billing what the client already took', () => {
  const GOOD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('counts the pieces the client has beyond the plan', () => {
    expect(billablePieces(entry({ plannedQuantity: 3, actualQuantity: 4 }))).toBe(1);
  });

  it('is zero when the client had less than planned, which is a delivery instead', () => {
    expect(billablePieces(entry({ plannedQuantity: 10, actualQuantity: 7 }))).toBe(0);
  });

  it('accepts a product taken beyond the plan', () => {
    expect(isBillable(entry({ productId: PRODUCT, plannedQuantity: 0, actualQuantity: 1 }))).toBe(true);
  });

  it('accepts a supplier good taken beyond the plan', () => {
    expect(isBillable(entry({
      target: ClientLedgerEntryTarget.SupplierGoodQuantity,
      supplierGoodId: GOOD,
      plannedQuantity: 0,
      actualQuantity: 2,
    }))).toBe(true);
  });

  // Empties handed back in excess are a deposit to return, not something to bill.
  it('rejects an over-return', () => {
    expect(isBillable(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      lineName: 'Basy',
      plannedQuantity: 0,
      actualQuantity: 2,
    }))).toBe(false);
  });

  it('rejects one an order is already carrying', () => {
    expect(isBillable(entry({
      productId: PRODUCT,
      plannedQuantity: 0,
      actualQuantity: 1,
      resolvedByOrderId: ORDER_CARRYING,
    }))).toBe(false);
  });

  it('rejects money, which has no pieces at all', () => {
    expect(isBillable(entry({ target: ClientLedgerEntryTarget.Money, amount: 100 }))).toBe(false);
  });
});

describe('ledgerNoteText', () => {
  const money = (v: number) => `${v} Kč`;

  // A note is read as a sentence, so it starts like one.
  it('writes money to collect as a sentence', () => {
    expect(ledgerNoteText(entry({ target: ClientLedgerEntryTarget.Money, amount: 100 }), money))
      .toBe('Vybrat 100 Kč');
  });

  it('names the line a deposit belongs to', () => {
    const text = ledgerNoteText(entry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      lineName: 'Basy prázdných',
      plannedQuantity: 0,
      actualQuantity: 2,
    }), money);

    expect(text).toBe('Vrátit zálohu za 2 ks — Basy prázdných');
  });

  // Same wording as the card's instruction, so the two cannot drift apart.
  it('reuses the instruction the card shows', () => {
    const e = entry({ target: ClientLedgerEntryTarget.Money, amount: -250 });

    expect(ledgerNoteText(e, money).toLowerCase())
      .toContain(ledgerTodo(e, money).text.toLowerCase());
  });
});

describe('a shortfall on a custom extra', () => {
  const extra = (over: Partial<ClientLedgerEntryDto> = {}) => entry({
    target: ClientLedgerEntryTarget.CustomExtraQuantity,
    lineName: 'Tácky',
    plannedQuantity: 7,
    actualQuantity: 6,
    ...over,
  });

  // The order has a list for these, so it carries another row of it rather than a remark.
  it('goes on the order Položky navíc', () => {
    expect(ledgerTodo(extra(), (v) => `${v} Kč`))
      .toEqual({ text: 'dovézt 1 ks', action: 'extras' });
    expect(isExtraSettleable(extra())).toBe(true);
  });

  it('is not settleable once an order carries it', () => {
    expect(isExtraSettleable(extra({ resolvedByOrderId: ORDER_CARRYING }))).toBe(false);
  });

  // Over-delivered is the other direction and has nothing to do with this list.
  it('is not a Položky navíc row when the client got more than planned', () => {
    expect(isExtraSettleable(extra({ plannedQuantity: 0, actualQuantity: 3 }))).toBe(false);
  });
});
