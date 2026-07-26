import { describe, it, expect } from 'vitest';
import { ProductKind } from 'src/generated/api-client';
import { groupByKind, KIND_ORDER } from './nakladkaGrouping';

const row = (
  name: string,
  kind?: ProductKind | string | number,
  platoDegree?: number,
  packageSize?: number,
) => ({ name, kind, platoDegree, packageSize });

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

  it('sorts a section by degree, then by package size', () => {
    const rows = [
      row('12° velká', 'Bottle', 12, 0.5),
      row('10° malá', 'Bottle', 10, 0.33),
      row('12° malá', 'Bottle', 12, 0.33),
      row('10° velká', 'Bottle', 10, 0.5),
    ];

    expect(groupByKind(rows)[0].rows.map((r) => r.name))
      .toEqual(['10° malá', '10° velká', '12° malá', '12° velká']);
  });

  it('puts rows without a degree after the beers', () => {
    // A missing degree is not a zero-degree beer — it is something else entirely.
    const rows = [row('bez stupňů', 'Keg', undefined, 30), row('11°', 'Keg', 11, 50)];

    expect(groupByKind(rows)[0].rows.map((r) => r.name)).toEqual(['11°', 'bez stupňů']);
  });

  it('does not reorder the caller\u2019s array', () => {
    const rows = [row('b', 'Bottle', 12), row('a', 'Bottle', 10)];

    groupByKind(rows);

    expect(rows.map((r) => r.name)).toEqual(['b', 'a']);
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
