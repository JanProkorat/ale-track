import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { DeliveryStopKind, SupplierChargeKind } from 'src/generated/api-client';
import {
  lineKey, lineWireFields, sameLine, serializeDelivery, stopWireFields,
  type DraftLine, type DraftStop,
} from './deliveryDraft';

const productLine: DraftLine = { source: 'product', productId: 'p1', quantity: 1 };
const fillLine: DraftLine = { source: 'good', supplierGoodId: 'g1', chargeKind: SupplierChargeKind.Fill, quantity: 1 };
const rentLine: DraftLine = { source: 'good', supplierGoodId: 'g1', chargeKind: SupplierChargeKind.Rent, quantity: 1 };

function stop(over: Partial<DraftStop> = {}): DraftStop {
  return { key: 'k', kind: 'brewery', breweryId: 'b1', supplierId: '', note: '', items: [], ...over };
}

describe('lineKey', () => {
  it('separates two charge kinds of one good', () => {
    expect(lineKey(fillLine)).not.toBe(lineKey(rentLine));
  });

  /**
   * A line loaded from the API holds the wire string, one just added holds the numeric member. If
   * the key differed between them the same line would appear in the cart twice, and editing one
   * copy would leave the other behind.
   */
  it('gives one line the same key in either wire form', () => {
    const loaded = { ...fillLine, chargeKind: 'Fill' as unknown as SupplierChargeKind };

    expect(lineKey(loaded)).toBe(lineKey(fillLine));
    expect(sameLine(loaded, fillLine)).toBe(true);
  });

  it('never confuses a product with a good', () => {
    expect(lineKey(productLine)).not.toBe(lineKey(fillLine));
  });
});

describe('stopWireFields', () => {
  it('sends a brewery stop only its brewery', () => {
    const fields = stopWireFields(stop());

    expect(fields.kind).toBe(DeliveryStopKind.Brewery);
    expect(fields.breweryId).toBe('b1');
    expect(fields.supplierId).toBeUndefined();
    expect(fields.label).toBeUndefined();
    expect(fields.latitude).toBeUndefined();
  });

  /** The backend rejects a stop carrying another kind's place, so this must not leak either way. */
  it('sends a supplier stop only its supplier', () => {
    const fields = stopWireFields(stop({ kind: 'supplier', breweryId: '', supplierId: 's1' }));

    expect(fields.kind).toBe(DeliveryStopKind.Supplier);
    expect(fields.supplierId).toBe('s1');
    expect(fields.breweryId).toBeUndefined();
    expect(fields.label).toBeUndefined();
  });

  it('sends a custom stop its label and coordinates and no place', () => {
    const fields = stopWireFields(stop({
      kind: 'custom', breweryId: '', supplierId: '', label: 'Oběd', lat: 50.1, lng: 14.4,
    }));

    expect(fields.kind).toBe(DeliveryStopKind.Custom);
    expect(fields.label).toBe('Oběd');
    expect(fields.latitude).toBe(50.1);
    expect(fields.longitude).toBe(14.4);
    expect(fields.breweryId).toBeUndefined();
    expect(fields.supplierId).toBeUndefined();
  });

  it('drops a blank note rather than sending an empty string', () => {
    expect(stopWireFields(stop({ note: '   ' })).note).toBeUndefined();
  });
});

describe('lineWireFields', () => {
  it('sends a product line its product and nothing of the other source', () => {
    const fields = lineWireFields(productLine);

    expect(fields).toEqual({ productId: 'p1', quantity: 1, note: undefined });
  });

  it('sends a good line its good and charge kind', () => {
    const fields = lineWireFields({ ...fillLine, quantity: 3, note: 'vyměnit' });

    expect(fields).toEqual({
      supplierGoodId: 'g1',
      chargeKind: SupplierChargeKind.Fill,
      quantity: 3,
      note: 'vyměnit',
    });
  });
});

describe('serializeDelivery', () => {
  const date = dayjs('2026-08-20');

  it('changes when a supplier stop is added', () => {
    const before = serializeDelivery(date, null, [], '', [stop()]);
    const after = serializeDelivery(date, null, [], '', [stop(), stop({ key: 'k2', kind: 'supplier', breweryId: '', supplierId: 's1' })]);

    expect(after).not.toBe(before);
  });

  it('changes when a line note is written', () => {
    const before = serializeDelivery(date, null, [], '', [stop({ items: [fillLine] })]);
    const after = serializeDelivery(date, null, [], '', [stop({ items: [{ ...fillLine, note: 'vyměnit' }] })]);

    expect(after).not.toBe(before);
  });

  /**
   * Reloading the same delivery must not read as an unsaved change. The enum arriving as a string
   * where the editor had a number is exactly the difference that would otherwise show the guard
   * dialog on a delivery nobody had touched.
   */
  it('is unchanged by which wire form the charge kind is in', () => {
    const numeric = serializeDelivery(date, null, [], '', [stop({ items: [fillLine] })]);
    const wire = serializeDelivery(date, null, [], '', [stop({
      items: [{ ...fillLine, chargeKind: 'Fill' as unknown as SupplierChargeKind }],
    })]);

    expect(wire).toBe(numeric);
  });

  it('changes when a supplier stop points at a different supplier', () => {
    const before = serializeDelivery(date, null, [], '', [stop({ kind: 'supplier', breweryId: '', supplierId: 's1' })]);
    const after = serializeDelivery(date, null, [], '', [stop({ kind: 'supplier', breweryId: '', supplierId: 's2' })]);

    expect(after).not.toBe(before);
  });
});
