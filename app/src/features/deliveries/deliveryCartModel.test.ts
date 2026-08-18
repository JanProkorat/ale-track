import { describe, expect, it } from 'vitest';
import {
  ProductKind, SupplierChargeKind,
  type BreweryProductListItemDto, type SupplierDto,
} from 'src/generated/api-client';
import { buildCartRows, cartTotalPrice, cartTotalQuantity, type CartCatalogues } from './deliveryCartModel';
import type { DraftLine, DraftStop } from './deliveryDraft';
import { SUPPLIER_COLOR } from './stopVisuals';

const BREWERY_ID = 'brewery-1';
const SUPPLIER_ID = 'supplier-1';

function product(over: Partial<BreweryProductListItemDto> = {}): BreweryProductListItemDto {
  return {
    id: 'product-1',
    name: 'Svijanská Desítka',
    kind: ProductKind.Can,
    packageSize: 0.5,
    priceWithVat: 25.08,
    ...over,
  } as BreweryProductListItemDto;
}

function supplier(over: Partial<SupplierDto> = {}): SupplierDto {
  return {
    id: SUPPLIER_ID,
    name: 'Linde Gas',
    goods: [
      {
        id: 'good-1',
        name: 'CO₂ láhev',
        size: '10 kg',
        prices: [
          { kind: SupplierChargeKind.Fill, priceWithVat: 640 },
          { kind: SupplierChargeKind.Rent, priceWithVat: 90 },
        ],
      },
    ],
    ...over,
  } as SupplierDto;
}

function breweryStop(items: DraftLine[]): DraftStop {
  return { key: 'stop-b', kind: 'brewery', breweryId: BREWERY_ID, supplierId: '', note: '', items };
}

function supplierStop(items: DraftLine[]): DraftStop {
  return { key: 'stop-s', kind: 'supplier', breweryId: '', supplierId: SUPPLIER_ID, note: '', items };
}

function catalogues(over: Partial<CartCatalogues> = {}): CartCatalogues {
  return {
    byBrewery: new Map([[BREWERY_ID, [product()]]]),
    bySupplier: new Map([[SUPPLIER_ID, supplier()]]),
    breweryColor: new Map([[BREWERY_ID, '#C22A2A']]),
    ...over,
  };
}

const fill: DraftLine = { source: 'good', supplierGoodId: 'good-1', chargeKind: SupplierChargeKind.Fill, quantity: 1 };
const rent: DraftLine = { source: 'good', supplierGoodId: 'good-1', chargeKind: SupplierChargeKind.Rent, quantity: 1 };
const canned: DraftLine = { source: 'product', productId: 'product-1', quantity: 2 };

describe('buildCartRows', () => {
  it('prices a product line from its brewery and carries the brewery colour', () => {
    const [row] = buildCartRows([breweryStop([canned])], catalogues());

    expect(row.name).toBe('Svijanská Desítka');
    expect(row.unitPrice).toBe(25.08);
    expect(row.quantity).toBe(2);
    expect(row.color).toBe('#C22A2A');
    expect(row.details).toEqual(['Plechovka', '0,5 l']);
  });

  it('prices a good line from the charge kind the line is for', () => {
    const rows = buildCartRows([supplierStop([fill, rent])], catalogues());

    expect(rows.map((r) => r.unitPrice)).toEqual([640, 90]);
    expect(rows.map((r) => r.details)).toEqual([['Plnění', '10 kg'], ['Nájem', '10 kg']]);
    expect(rows.every((r) => r.color === SUPPLIER_COLOR)).toBe(true);
  });

  /**
   * The bug this guards: pricing every line of a good from its first price would bill a rented
   * bottle at the refill rate, and the two rows would silently show the same number.
   */
  it('keeps two charge kinds of one good apart', () => {
    const rows = buildCartRows([supplierStop([fill, rent])], catalogues());

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    expect(rows[0].unitPrice).not.toBe(rows[1].unitPrice);
  });

  /** A line loaded from the API carries the wire string; one just added carries the enum member. */
  it('matches a price when the line holds the wire form of the charge kind', () => {
    const loaded = { ...fill, chargeKind: 'Fill' as unknown as SupplierChargeKind };

    const [row] = buildCartRows([supplierStop([loaded])], catalogues());

    expect(row.unitPrice).toBe(640);
    expect(row.details).toEqual(['Plnění', '10 kg']);
  });

  it('flattens every stop in stop order', () => {
    const rows = buildCartRows([breweryStop([canned]), supplierStop([fill])], catalogues());

    expect(rows.map((r) => r.name)).toEqual(['Svijanská Desítka', 'CO₂ láhev']);
    expect(rows.map((r) => r.stopKey)).toEqual(['stop-b', 'stop-s']);
  });

  /**
   * A line whose catalogue is still loading keeps its row with no price — dropping it would make
   * the cart's count disagree with the stop card for as long as the fetch takes.
   */
  it('keeps a row without a price when the catalogue has not loaded', () => {
    const rows = buildCartRows(
      [breweryStop([canned]), supplierStop([fill])],
      catalogues({ byBrewery: new Map(), bySupplier: new Map() }),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.unitPrice)).toEqual([null, null]);
    expect(rows.map((r) => r.name)).toEqual(['—', '—']);
  });

  it('gives a custom stop no rows', () => {
    const custom: DraftStop = { key: 'stop-c', kind: 'custom', breweryId: '', supplierId: '', note: '', items: [], label: 'Oběd' };

    expect(buildCartRows([custom], catalogues())).toEqual([]);
  });

  it('reads the line note onto its row', () => {
    const [row] = buildCartRows([supplierStop([{ ...fill, note: 'vyměnit za prázdné' }])], catalogues());

    expect(row.note).toBe('vyměnit za prázdné');
  });
});

describe('cart totals', () => {
  it('counts units across stops', () => {
    const rows = buildCartRows([breweryStop([canned]), supplierStop([fill])], catalogues());

    expect(cartTotalQuantity(rows)).toBe(3);
  });

  it('sums price with VAT per unit', () => {
    const rows = buildCartRows([breweryStop([canned]), supplierStop([fill])], catalogues());

    expect(cartTotalPrice(rows)).toBeCloseTo(25.08 * 2 + 640, 5);
  });

  /** An unpriced row contributes nothing rather than making the whole total unavailable. */
  it('sums what it can while a catalogue is still loading', () => {
    const rows = buildCartRows(
      [breweryStop([canned]), supplierStop([fill])],
      catalogues({ bySupplier: new Map() }),
    );

    expect(cartTotalPrice(rows)).toBeCloseTo(25.08 * 2, 5);
  });
});
