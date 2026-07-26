import { describe, it, expect } from 'vitest';
import { ReportGranularity } from 'src/generated/api-client';
import { periodRange, fmtKg, sharePct, fmtUnits, apiGranularity, bucketLabel, PERIOD_LABEL } from './reportModel';

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

describe('fmtUnits', () => {
  it('appends the "ks" suffix with no decimals', () => {
    expect(fmtUnits(120)).toBe('120 ks');
    expect(fmtUnits(0)).toBe('0 ks');
  });
});

describe('apiGranularity', () => {
  it('maps the UI granularity onto the generated enum', () => {
    expect(apiGranularity('week')).toBe(ReportGranularity.Week);
    expect(apiGranularity('month')).toBe(ReportGranularity.Month);
  });
});

describe('bucketLabel', () => {
  it('renders a month bucket as the short Czech abbreviation, both wire forms', () => {
    // T12:00:00Z, matching periodRange's tests above — noon UTC stays the same
    // calendar day in every real-world timezone, so this isn't a local-time flake.
    expect(bucketLabel('2026-07-01T12:00:00Z', 'month')).toBe('čvc');
    expect(bucketLabel(new Date('2026-07-01T12:00:00Z'), 'month')).toBe('čvc');
    expect(bucketLabel('2026-01-01T12:00:00Z', 'month')).toBe('led');
  });

  it('renders a week/day bucket as "D.M." with no spaces, both wire forms', () => {
    expect(bucketLabel('2026-07-20T12:00:00Z', 'week')).toBe('20.7.');
    expect(bucketLabel(new Date('2026-07-20T12:00:00Z'), 'week')).toBe('20.7.');
  });

  it('reads "—" for a missing or invalid value', () => {
    expect(bucketLabel(undefined, 'week')).toBe('—');
    expect(bucketLabel('not-a-date', 'week')).toBe('—');
  });
});

describe('PERIOD_LABEL', () => {
  it('matches the prototype wording', () => {
    expect(PERIOD_LABEL['30']).toBe('posledních 30 dní');
    expect(PERIOD_LABEL['90']).toBe('posledních 90 dní');
    expect(PERIOD_LABEL['180']).toBe('posledních 6 měsíců');
  });
});
