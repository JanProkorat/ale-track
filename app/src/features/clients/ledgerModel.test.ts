import { describe, expect, it } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import {
  applyLedger,
  deliveredEntryFor,
  deviationText,
  entryLineKey,
  entryTooltip,
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
    expect(deviationText(rows[1])).toBe('Přidáno na místě');
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
