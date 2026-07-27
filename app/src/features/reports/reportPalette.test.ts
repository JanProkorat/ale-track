import { describe, it, expect } from 'vitest';
import { ProductType } from 'src/generated/api-client';
import { ptypeLabel } from 'src/lib/labels';
import { REPORT_PALETTE_DARK, REPORT_PALETTE_LIGHT, foldTypes, typeSlot } from './reportPalette';

describe('report palette', () => {
  it('has 7 slots in both schemes', () => {
    expect(REPORT_PALETTE_LIGHT).toHaveLength(7);
    expect(REPORT_PALETTE_DARK).toHaveLength(7);
  });

  it('never repeats a hex within a scheme', () => {
    expect(new Set(REPORT_PALETTE_LIGHT).size).toBe(7);
    expect(new Set(REPORT_PALETTE_DARK).size).toBe(7);
  });
});

describe('typeSlot', () => {
  it('gives a type the same slot regardless of how the data is ordered', () => {
    expect(typeSlot(ProductType.PaleLager)).toBe(typeSlot(ProductType.PaleLager));
    expect(typeSlot(ProductType.PaleLager)).not.toBe(typeSlot(ProductType.DarkLager));
  });

  it('sends every type outside the fixed six to the shared last slot', () => {
    expect(typeSlot(ProductType.Merchandise)).toBe(6);
    expect(typeSlot(ProductType.Lemonade)).toBe(6);
    expect(typeSlot(ProductType.Mix)).toBe(6);
  });
});

describe('foldTypes', () => {
  const palette = REPORT_PALETTE_LIGHT;

  it('colours a type by identity, so reordering the rows does not repaint it', () => {
    const pale = { type: ProductType.PaleLager, weightKg: 90, units: 9 };
    const dark = { type: ProductType.DarkLager, weightKg: 10, units: 1 };

    const ascending = foldTypes([dark, pale], palette);
    const descending = foldTypes([pale, dark], palette);

    // Each type keeps its own slot colour whichever order it arrived in, and the two
    // types never share a colour.
    const paleColor = palette[typeSlot(ProductType.PaleLager)];
    const darkColor = palette[typeSlot(ProductType.DarkLager)];
    expect(paleColor).not.toBe(darkColor);

    for (const rows of [ascending, descending]) {
      expect(rows.find((r) => r.value === 90)!.color).toBe(paleColor);
      expect(rows.find((r) => r.value === 10)!.color).toBe(darkColor);
    }
  });

  it("changing which type leads does not change any type's colour", () => {
    // The prototype's bug: it sorted by volume, then indexed the palette by position,
    // so a period change repainted every slice. Guard against a regression.
    const heavyPale = foldTypes(
      [
        { type: ProductType.PaleLager, weightKg: 900, units: 9 },
        { type: ProductType.DarkLager, weightKg: 10, units: 1 },
      ],
      palette
    );
    const heavyDark = foldTypes(
      [
        { type: ProductType.PaleLager, weightKg: 10, units: 1 },
        { type: ProductType.DarkLager, weightKg: 900, units: 9 },
      ],
      palette
    );

    const colorOf = (rows: typeof heavyPale, label: string) => rows.find((r) => r.label === label)!.color;
    const paleLabel = ptypeLabel(ProductType.PaleLager)!;
    const darkLabel = ptypeLabel(ProductType.DarkLager)!;

    expect(colorOf(heavyPale, paleLabel)).toBe(colorOf(heavyDark, paleLabel));
    expect(colorOf(heavyPale, darkLabel)).toBe(colorOf(heavyDark, darkLabel));
  });

  it('merges everything beyond the fixed six into one Ostatní row', () => {
    const rows = foldTypes(
      [
        { type: ProductType.Merchandise, weightKg: 5, units: 1 },
        { type: ProductType.Lemonade, weightKg: 7, units: 2 },
      ],
      palette
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Ostatní');
    expect(rows[0].value).toBe(12);
    expect(rows[0].color).toBe(palette[6]);
  });

  it('sorts rows by value descending while keeping Ostatní last', () => {
    const rows = foldTypes(
      [
        { type: ProductType.Merchandise, weightKg: 1000, units: 1 },
        { type: ProductType.PaleLager, weightKg: 10, units: 1 },
        { type: ProductType.DarkLager, weightKg: 20, units: 1 },
      ],
      palette
    );

    expect(rows.map((r) => r.label)).toEqual(['Tmavý ležák', 'Světlý ležák', 'Ostatní']);
  });

  it('returns nothing for no rows', () => {
    expect(foldTypes([], palette)).toEqual([]);
  });
});
