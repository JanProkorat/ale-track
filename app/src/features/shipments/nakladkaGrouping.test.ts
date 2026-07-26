import { describe, it, expect } from 'vitest';
import { ProductKind } from 'src/generated/api-client';
import { groupByKind, KIND_ORDER } from './nakladkaGrouping';

const row = (name: string, kind?: ProductKind | string | number) => ({ name, kind });

describe('groupByKind', () => {
  it('orders the sections the way the van is packed', () => {
    const rows = [row('sud', 'Keg'), row('basa', 'Bottle'), row('ostatní', 'Other'),
      row('multipack', 'Multipack'), row('plechovka', 'Can')];

    expect(groupByKind(rows).map((s) => s.kind)).toEqual(['Bottle', 'Can', 'Multipack', 'Other', 'Keg']);
  });

  it('leaves out kinds the shipment does not carry', () => {
    expect(groupByKind([row('basa', 'Bottle'), row('sud', 'Keg')]).map((s) => s.kind))
      .toEqual(['Bottle', 'Keg']);
  });

  it('keeps the incoming row order inside a section', () => {
    // The API already sorts by the brewery's display order.
    const rows = [row('b', 'Bottle'), row('a', 'Bottle'), row('c', 'Bottle')];

    expect(groupByKind(rows)[0].rows.map((r) => r.name)).toEqual(['b', 'a', 'c']);
  });

  it('reads the numeric enum as well as the wire string', () => {
    // Both representations reach the UI; matching only one silently mis-sorts.
    const rows = [row('sud', ProductKind.Keg), row('basa', ProductKind.Bottle)];

    expect(groupByKind(rows).map((s) => s.kind)).toEqual(['Bottle', 'Keg']);
  });

  it('reads out anything without a kind with the odds and ends', () => {
    const rows = [row('basa', 'Bottle'), row('záhada'), row('divné', 'Nonsense')];

    const sections = groupByKind(rows);
    expect(sections.map((s) => s.kind)).toEqual(['Bottle', 'Other']);
    expect(sections[1].rows.map((r) => r.name)).toEqual(['záhada', 'divné']);
  });

  it('labels the sections in Czech', () => {
    expect(groupByKind([row('basa', 'Bottle'), row('sud', 'Keg')]).map((s) => s.label))
      .toEqual(['Basa', 'Sud']);
  });

  it('is empty for no rows', () => {
    expect(groupByKind([])).toEqual([]);
  });

  it('covers every kind the enum has', () => {
    // A new ProductKind must be placed deliberately, not silently swept into Other.
    const enumNames = Object.keys(ProductKind).filter((k) => Number.isNaN(Number(k)));
    expect([...KIND_ORDER].sort()).toEqual(enumNames.sort());
  });
});
