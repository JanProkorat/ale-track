import { describe, it, expect } from 'vitest';
import {
  AddressDto, Country, SupplierChargeKind, SupplierGoodDto, SupplierGoodPriceDto,
} from 'src/generated/api-client';
import {
  cheapestFill, matchesSupplierSearch, priceCount, pricesOrdered, supplierSearchKey,
} from './supplierGoods';

const price = (kind: SupplierChargeKind, withVat: number, note?: string) =>
  new SupplierGoodPriceDto({ kind, priceWithVat: withVat, note });

const good = (name: string, prices: SupplierGoodPriceDto[], size?: string) =>
  new SupplierGoodDto({ id: crypto.randomUUID(), name, size, prices });

const CO2_10 = good('CO₂ láhev', [
  price(SupplierChargeKind.Deposit, 1200, 'vratná'),
  price(SupplierChargeKind.Fill, 450),
  price(SupplierChargeKind.Purchase, 2900),
], '10 kg');

const CO2_30 = good('CO₂ láhev', [price(SupplierChargeKind.Fill, 980)], '30 kg');
const CRATE = good('Přepravka', [
  price(SupplierChargeKind.Purchase, 210),
  price(SupplierChargeKind.Deposit, 180),
]);

describe('pricesOrdered', () => {
  it('reads Plnění → Nákup → Záloha regardless of arrival order', () => {
    expect(pricesOrdered(CO2_10).map((p) => p.kind)).toEqual([
      SupplierChargeKind.Fill, SupplierChargeKind.Purchase, SupplierChargeKind.Deposit,
    ]);
  });

  it('puts Nájem after Záloha and Ostatní last', () => {
    const g = good('Biogon', [
      price(SupplierChargeKind.Other, 10),
      price(SupplierChargeKind.Rent, 45),
      price(SupplierChargeKind.Deposit, 900),
    ]);
    expect(pricesOrdered(g).map((p) => p.kind)).toEqual([
      SupplierChargeKind.Deposit, SupplierChargeKind.Rent, SupplierChargeKind.Other,
    ]);
  });

  it('does not mutate the good it was given', () => {
    const before = CO2_10.prices!.map((p) => p.kind);
    pricesOrdered(CO2_10);
    expect(CO2_10.prices!.map((p) => p.kind)).toEqual(before);
  });

  it('handles a good with no prices', () => {
    expect(pricesOrdered(new SupplierGoodDto({ name: 'x' }))).toEqual([]);
  });
});

describe('priceCount', () => {
  it('counts price rows across goods, not the goods themselves', () => {
    expect(priceCount([CO2_10, CO2_30, CRATE])).toBe(6);
  });

  it('is zero for an empty or missing list', () => {
    expect(priceCount([])).toBe(0);
    expect(priceCount(undefined)).toBe(0);
  });
});

describe('cheapestFill', () => {
  it('picks the lowest refill and ignores purchases and deposits', () => {
    expect(cheapestFill([CO2_10, CO2_30])).toBe(450);
  });

  it('is null when the supplier refills nothing', () => {
    // A packaging wholesaler sells and takes deposits, but fills nothing.
    expect(cheapestFill([CRATE])).toBeNull();
  });

  it('is null for an empty list', () => {
    expect(cheapestFill([])).toBeNull();
  });
});

describe('supplierSearchKey', () => {
  it('folds subscript digits so a keyboard "co2" reaches "CO₂"', () => {
    expect(supplierSearchKey('CO₂ láhev')).toBe('co2 lahev');
  });

  it('folds diacritics', () => {
    expect(supplierSearchKey('Frýdlant')).toBe('frydlant');
    expect(supplierSearchKey('Žitava')).toBe('zitava');
  });

  it('is empty for nothing', () => {
    expect(supplierSearchKey(undefined)).toBe('');
    expect(supplierSearchKey('   ')).toBe('');
  });
});

describe('matchesSupplierSearch', () => {
  const row = {
    name: 'Gastro Plyn Žitava',
    businessName: 'Gastro Gas Zittau GmbH',
    officialAddress: new AddressDto({
      streetName: 'Bahnhofstraße', streetNumber: '12', city: 'Žitava', zip: '02763',
      country: Country.Germany,
    }),
    goodNames: ['Biogon C láhev', 'CO₂ láhev'],
  };

  it('matches an empty query', () => {
    expect(matchesSupplierSearch(row, '')).toBe(true);
  });

  it('matches on the supplier name without diacritics', () => {
    expect(matchesSupplierSearch(row, 'zitava')).toBe(true);
  });

  it('matches on the business name', () => {
    expect(matchesSupplierSearch(row, 'zittau gmbh')).toBe(true);
  });

  it('matches on the city', () => {
    expect(matchesSupplierSearch({ ...row, name: 'X', businessName: '', goodNames: [] }, 'žitava')).toBe(true);
  });

  it('matches on something the supplier sells', () => {
    expect(matchesSupplierSearch(row, 'biogon')).toBe(true);
  });

  it('matches a gas name typed with a plain digit', () => {
    expect(matchesSupplierSearch(row, 'co2')).toBe(true);
  });

  it('does not match an unrelated query', () => {
    expect(matchesSupplierSearch(row, 'sanitace')).toBe(false);
  });

  it('survives a row with no goods and no business name', () => {
    const bare = { name: 'Obaly Frýdlant', businessName: undefined, officialAddress: undefined };
    expect(matchesSupplierSearch(bare, 'obaly')).toBe(true);
    expect(matchesSupplierSearch(bare, 'co2')).toBe(false);
  });
});
