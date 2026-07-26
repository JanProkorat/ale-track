import { describe, it, expect } from 'vitest';
import { periodRange, fmtKg, sharePct, PERIOD_LABEL } from './reportModel';

describe('periodRange', () => {
  it('spans the requested number of days back from today, inclusive of today', () => {
    const today = new Date('2026-07-25T12:00:00Z');
    expect(periodRange('30', today)).toEqual({ from: '2026-06-25', to: '2026-07-25' });
    expect(periodRange('90', today)).toEqual({ from: '2026-04-26', to: '2026-07-25' });
    expect(periodRange('180', today)).toEqual({ from: '2026-01-26', to: '2026-07-25' });
  });

  it('crosses a year boundary correctly', () => {
    expect(periodRange('90', new Date('2026-02-10T12:00:00Z')).from).toBe('2025-11-12');
  });
});

describe('fmtKg', () => {
  it('switches to tonnes at 1000 kg with one decimal', () => {
    expect(fmtKg(1500)).toBe('1,5 t');
    expect(fmtKg(12400)).toBe('12,4 t');
  });

  it('forces the decimal on a whole number of tonnes, as the prototype does', () => {
    // The prototype's nf(n, 1) sets minimumFractionDigits too, so this is "2,0 t".
    // num() alone would render "2 t".
    expect(fmtKg(2000)).toBe('2,0 t');
    expect(fmtKg(10000)).toBe('10,0 t');
  });

  it('keeps kilograms below 1000, with no decimals', () => {
    expect(fmtKg(999)).toBe('999 kg');
    expect(fmtKg(0)).toBe('0 kg');
  });
});

describe('sharePct', () => {
  it('formats a share to one decimal', () => {
    expect(sharePct(25, 200)).toBe('12,5 %');
  });

  it('forces the decimal on a whole percentage', () => {
    expect(sharePct(24, 200)).toBe('12,0 %');
  });

  it('reads 0 rather than dividing by zero on an empty total', () => {
    expect(sharePct(0, 0)).toBe('0,0 %');
  });
});

describe('PERIOD_LABEL', () => {
  it('matches the prototype wording', () => {
    expect(PERIOD_LABEL['30']).toBe('posledních 30 dní');
    expect(PERIOD_LABEL['90']).toBe('posledních 90 dní');
    expect(PERIOD_LABEL['180']).toBe('posledních 6 měsíců');
  });
});
