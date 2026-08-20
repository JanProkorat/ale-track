import { describe, it, expect } from 'vitest';
import { packagingLabel, containerValue, saleUnitValue } from './labels';
import { ProductContainer, ProductSaleUnit } from 'src/generated/api-client';

// Every member must round-trip. A value that falls back to a different member would
// silently reclassify a product the next time its form was saved.
describe('containerValue / saleUnitValue', () => {
  it('round-trips every container from its wire name', () => {
    expect(containerValue('Keg')).toBe(ProductContainer.Keg);
    expect(containerValue('Bottle')).toBe(ProductContainer.Bottle);
    expect(containerValue('Can')).toBe(ProductContainer.Can);
    expect(containerValue('Jug')).toBe(ProductContainer.Jug);
    expect(containerValue('Other')).toBe(ProductContainer.Other);
  });

  it('round-trips every sale unit from its wire name', () => {
    expect(saleUnitValue('Single')).toBe(ProductSaleUnit.Single);
    expect(saleUnitValue('Crate')).toBe(ProductSaleUnit.Crate);
    expect(saleUnitValue('Multipack')).toBe(ProductSaleUnit.Multipack);
    expect(saleUnitValue('Tray')).toBe(ProductSaleUnit.Tray);
  });

  it('round-trips the numeric representation unchanged', () => {
    expect(containerValue(ProductContainer.Jug)).toBe(ProductContainer.Jug);
    expect(saleUnitValue(ProductSaleUnit.Tray)).toBe(ProductSaleUnit.Tray);
  });

  it('returns undefined rather than guessing when the value is missing or unknown', () => {
    expect(containerValue(undefined)).toBeUndefined();
    expect(containerValue('Barrel')).toBeUndefined();
    expect(saleUnitValue(undefined)).toBeUndefined();
  });
});

// The strings are the real wire form: the backend serializes enums by name, so these are
// the values a loaded product actually carries.
describe('packagingLabel', () => {
  it('names each sale unit the way the price list does', () => {
    expect(packagingLabel('Keg', 'Single', 30, 1)).toBe('Sud 30 l');
    expect(packagingLabel('Bottle', 'Crate', 0.5, 20)).toBe('Basa 20×0,5 l');
    expect(packagingLabel('Can', 'Tray', 0.5, 24)).toBe('Tray 24×0,5 l');
    expect(packagingLabel('Bottle', 'Multipack', 0.5, 8)).toBe('Multipack 8×0,5 l');
  });

  it('distinguishes the two different 2 l products', () => {
    // Both were "Basa" before: same kind, same volume, physically different things.
    expect(packagingLabel('Can', 'Single', 2, 1)).toBe('Plechovka 2 l');
    expect(packagingLabel('Jug', 'Single', 2, 1)).toBe('Džbán 2 l');
  });

  it('never calls a jug a basa', () => {
    expect(packagingLabel('Jug', 'Single', 1, 1)).not.toContain('Basa');
    expect(packagingLabel('Jug', 'Single', 2, 1)).not.toContain('Basa');
  });

  it('shows the tray count, which differs by volume', () => {
    // 24 at 0,5 l but 12 at 0,33 l — the reason the count is stored rather than derived.
    expect(packagingLabel('Can', 'Tray', 0.33, 12)).toBe('Tray 12×0,33 l');
  });

  it('calls a two-pack a duopack', () => {
    expect(packagingLabel('Bottle', 'Multipack', 1, 2)).toBe('Duopack 2×1 l');
  });

  it('omits a count for a single container', () => {
    expect(packagingLabel('Bottle', 'Single', 0.5, 1)).toBe('Lahev 0,5 l');
  });

  it('degrades without crashing when packaging is unknown', () => {
    expect(packagingLabel(undefined, undefined, undefined, undefined)).toBe('—');
    expect(packagingLabel('Keg', 'Single', undefined, 1)).toBe('Sud');
  });

  it('accepts the numeric enum representation too', () => {
    // ProductContainer.Bottle = 2, ProductSaleUnit.Crate = 2.
    expect(packagingLabel(2, 2, 0.5, 20)).toBe('Basa 20×0,5 l');
  });
});
