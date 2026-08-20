// Pricing, grouping and search for the order editor's "Další zboží" tab.

import { describe, expect, it } from 'vitest';
import {
  SupplierChargeKind, SupplierDto, SupplierGoodDto, SupplierGoodPriceDto,
} from 'src/generated/api-client';
import { groupSupplierGoods, primaryPrice, resolvedGoodMap } from './supplierGoodCatalogModel';

function price(kind: SupplierChargeKind, withVat: number): SupplierGoodPriceDto {
  return new SupplierGoodPriceDto({ kind, priceWithVat: withVat });
}

function good(id: string, name: string, prices: SupplierGoodPriceDto[], size?: string): SupplierGoodDto {
  return new SupplierGoodDto({ id, name, size, prices });
}

function supplier(id: string, name: string, goods: SupplierGoodDto[]): SupplierDto {
  return new SupplierDto({ id, name, goods });
}

describe('primaryPrice', () => {
  it('prefers the Plnění price over every other charge kind, whatever the row order', () => {
    const g = good('g1', 'CO₂ láhev', [
      price(SupplierChargeKind.Deposit, 2500),
      price(SupplierChargeKind.Fill, 450),
      price(SupplierChargeKind.Rent, 80),
    ]);
    expect(primaryPrice(g)).toEqual({ price: 450, kind: SupplierChargeKind.Fill });
  });

  it('falls back to the first price when the good prices no refill', () => {
    const g = good('g2', 'KEG sud', [price(SupplierChargeKind.Purchase, 1800), price(SupplierChargeKind.Deposit, 900)]);
    expect(primaryPrice(g)).toEqual({ price: 1800, kind: SupplierChargeKind.Purchase });
  });

  it('is undefined for a good with no prices, and for no good at all', () => {
    expect(primaryPrice(good('g3', 'Nic', []))).toBeUndefined();
    expect(primaryPrice(undefined)).toBeUndefined();
  });
});

describe('groupSupplierGoods', () => {
  const linde = supplier('s-linde', 'Linde Gas', [
    good('g-co2', 'CO₂ láhev', [price(SupplierChargeKind.Fill, 450)], '10 kg'),
    good('g-n2', 'Dusík láhev', [price(SupplierChargeKind.Fill, 700)], '50 l'),
  ]);
  const obaly = supplier('s-obaly', 'Obaly Morava', [
    good('g-keg', 'KEG sud nerez', [price(SupplierChargeKind.Purchase, 1800)]),
  ]);
  const empty = supplier('s-empty', 'Zatím nic', []);

  it('groups by supplier, sorted by name, dropping suppliers with no goods', () => {
    const groups = groupSupplierGoods([obaly, linde, empty], '');
    expect(groups.map((g) => g.supplierName)).toEqual(['Linde Gas', 'Obaly Morava']);
    expect(groups[0].goods).toHaveLength(2);
  });

  it('matches a good by name, folding diacritics and subscripts so "co2" finds CO₂', () => {
    const groups = groupSupplierGoods([linde, obaly], 'co2');
    expect(groups).toHaveLength(1);
    expect(groups[0].goods.map((g) => g.name)).toEqual(['CO₂ láhev']);
  });

  it('keeps every good of a supplier whose own name matches', () => {
    const groups = groupSupplierGoods([linde, obaly], 'linde');
    expect(groups).toHaveLength(1);
    expect(groups[0].goods).toHaveLength(2);
  });

  it('returns nothing when neither a supplier nor a good matches', () => {
    expect(groupSupplierGoods([linde, obaly], 'sanitace')).toEqual([]);
  });
});

describe('resolvedGoodMap', () => {
  it('maps every good id to its good and owning supplier', () => {
    const map = resolvedGoodMap([
      supplier('s-linde', 'Linde Gas', [good('g-co2', 'CO₂ láhev', [price(SupplierChargeKind.Fill, 450)])]),
      supplier('s-obaly', 'Obaly Morava', [good('g-keg', 'KEG sud', [price(SupplierChargeKind.Purchase, 1800)])]),
    ]);
    expect(map.get('g-co2')?.supplierName).toBe('Linde Gas');
    expect(map.get('g-keg')?.good.name).toBe('KEG sud');
    expect(map.get('nope')).toBeUndefined();
  });
});
