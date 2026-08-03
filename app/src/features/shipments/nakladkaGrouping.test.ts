import { describe, it, expect } from 'vitest';
import { ProductKind } from 'src/generated/api-client';
import { groupByBreweryThenKind, groupByKind, KIND_ORDER } from './nakladkaGrouping';

const row = (
  name: string,
  kind?: ProductKind | string | number,
  platoDegree?: number,
  packageSize?: number,
) => ({ name, kind, platoDegree, packageSize });

/** A row of a named brewery — `order` is the brewery's own display order. */
const supplied = (
  name: string,
  brewery: { id: string; name: string; order?: number },
  kind?: ProductKind | string | number,
  platoDegree?: number,
) => ({
  name,
  kind,
  platoDegree,
  breweryId: brewery.id,
  breweryName: brewery.name,
  breweryDisplayOrder: brewery.order,
});

const FRYDLANT = { id: 'b-1', name: 'Pivovar Frýdlant', order: 1 };
const SVIJANY = { id: 'b-2', name: 'Pivovar Svijany', order: 2 };

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

describe('groupByBreweryThenKind', () => {
  it('orders the brewery sections by the brewery display order, not by first appearance', () => {
    // Rows arrive in stop order, so the Svijany row comes first here.
    const rows = [
      supplied('Vozka', SVIJANY, 'Bottle', 11),
      supplied('Albrecht', FRYDLANT, 'Keg', 12),
    ];

    expect(groupByBreweryThenKind(rows).map((s) => s.label))
      .toEqual(['Pivovar Frýdlant', 'Pivovar Svijany']);
  });

  it('splits each brewery by kind, in loading order', () => {
    const rows = [
      supplied('sud F', FRYDLANT, 'Keg', 12),
      supplied('basa F', FRYDLANT, 'Bottle', 11),
      supplied('sud S', SVIJANY, 'Keg', 11),
    ];

    const sections = groupByBreweryThenKind(rows);
    expect(sections[0].kinds.map((k) => k.kind)).toEqual(['Bottle', 'Keg']);
    expect(sections[0].kinds[0].rows.map((r) => r.name)).toEqual(['basa F']);
    expect(sections[1].kinds.map((k) => k.kind)).toEqual(['Keg']);
  });

  it('keeps every row of a brewery on the section, for the heading count', () => {
    const rows = [
      supplied('sud', FRYDLANT, 'Keg', 12),
      supplied('basa', FRYDLANT, 'Bottle', 11),
      supplied('plech', FRYDLANT, 'Can', 10),
    ];

    expect(groupByBreweryThenKind(rows)[0].rows).toHaveLength(3);
  });

  it('sorts within a kind by degree, exactly as the flat grouping does', () => {
    const rows = [
      supplied('12°', FRYDLANT, 'Bottle', 12),
      supplied('10°', FRYDLANT, 'Bottle', 10),
    ];

    expect(groupByBreweryThenKind(rows)[0].kinds[0].rows.map((r) => r.name)).toEqual(['10°', '12°']);
  });

  it('falls back to the brewery name when two share a display order', () => {
    const rows = [
      supplied('b', { id: 'b-9', name: 'Žatec', order: 5 }, 'Keg', 11),
      supplied('a', { id: 'b-8', name: 'Chodovar', order: 5 }, 'Keg', 11),
    ];

    expect(groupByBreweryThenKind(rows).map((s) => s.label)).toEqual(['Chodovar', 'Žatec']);
  });

  it('reads out rows with no brewery in a section of their own, last', () => {
    // Defensive: the server names the brewery of every line. A row that lost it must still
    // be loaded rather than disappear from the list.
    const rows = [
      { name: 'záhada', kind: 'Keg', platoDegree: 11 },
      supplied('Vozka', SVIJANY, 'Bottle', 11),
    ];

    const sections = groupByBreweryThenKind(rows);
    expect(sections.map((s) => s.label)).toEqual(['Pivovar Svijany', 'Bez pivovaru']);
    expect(sections[1].rows.map((r) => r.name)).toEqual(['záhada']);
  });

  it('does not reorder the caller’s array', () => {
    const rows = [supplied('b', SVIJANY, 'Keg', 12), supplied('a', FRYDLANT, 'Keg', 10)];

    groupByBreweryThenKind(rows);

    expect(rows.map((r) => r.name)).toEqual(['b', 'a']);
  });

  it('is empty for no rows', () => {
    expect(groupByBreweryThenKind([])).toEqual([]);
  });
});
