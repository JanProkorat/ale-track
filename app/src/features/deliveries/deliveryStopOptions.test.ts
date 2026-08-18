import { describe, expect, it } from 'vitest';
import { buildStopOptions, parseStopOption } from './deliveryStopOptions';

const breweries = [{ id: 'b1', name: 'Svijany' }, { id: 'b2', name: 'Vinohradský' }];
const suppliers = [{ id: 's1', name: 'Linde Gas' }, { id: 's2', name: 'Obalservis' }];

function options(over: Partial<Parameters<typeof buildStopOptions>[0]> = {}) {
  return buildStopOptions({
    breweries,
    suppliers,
    usedBreweryIds: new Set(),
    usedSupplierIds: new Set(),
    canSeeSuppliers: true,
    ...over,
  });
}

describe('buildStopOptions', () => {
  it('offers both kinds in two groups', () => {
    const result = options();

    expect(result.filter((o) => o.group === 'Pivovary').map((o) => o.label)).toEqual(['Svijany', 'Vinohradský']);
    expect(result.filter((o) => o.group === 'Dodavatelé').map((o) => o.label)).toEqual(['Linde Gas', 'Obalservis']);
  });

  it('tags each value with the list it came from', () => {
    expect(options().map((o) => o.value)).toEqual([
      'brewery:b1', 'brewery:b2', 'supplier:s1', 'supplier:s2',
    ]);
  });

  /**
   * Two stops at one place are always a mistake — the items belong on one stop — and the backend
   * rejects them, so the picker stops offering a place already on the route.
   */
  it('drops places already on the route', () => {
    const result = options({ usedBreweryIds: new Set(['b1']), usedSupplierIds: new Set(['s2']) });

    expect(result.map((o) => o.value)).toEqual(['brewery:b2', 'supplier:s1']);
  });

  /**
   * The suppliers list is behind its own permission. Offering names the API will refuse would be a
   * picker whose entries fail on click.
   */
  it('offers no suppliers without the permission', () => {
    const result = options({ canSeeSuppliers: false });

    expect(result.every((o) => o.group === 'Pivovary')).toBe(true);
    expect(result).toHaveLength(2);
  });
});

describe('parseStopOption', () => {
  it('reads back a brewery and a supplier', () => {
    expect(parseStopOption('brewery:b1')).toEqual({ kind: 'brewery', id: 'b1' });
    expect(parseStopOption('supplier:s1')).toEqual({ kind: 'supplier', id: 's1' });
  });

  it('rejects anything it does not recognise', () => {
    expect(parseStopOption('b1')).toBeNull();
    expect(parseStopOption('brewery:')).toBeNull();
    expect(parseStopOption('client:c1')).toBeNull();
  });
});
