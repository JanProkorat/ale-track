import { describe, it, expect } from 'vitest';
import { ReportGranularity, type ClientVolumeRowDto } from 'src/generated/api-client';
import {
  periodRange,
  fmtKg,
  sharePct,
  fmtUnits,
  apiGranularity,
  bucketLabel,
  clientMetricValue,
  clientMetricFormat,
  bandAxisWidth,
  tonnesAxisTick,
  PERIOD_LABEL,
} from './reportModel';

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

describe('clientMetricValue / clientMetricFormat', () => {
  const row = { weightKg: 9000, units: 200 } as ClientVolumeRowDto;

  it('reads weight for the kg metric and formats it in tonnes', () => {
    expect(clientMetricValue(row, 'kg')).toBe(9000);
    expect(clientMetricFormat(clientMetricValue(row, 'kg'), 'kg')).toBe('9,0 t');
  });

  it('reads the unit count for the units metric and formats it with "ks"', () => {
    expect(clientMetricValue(row, 'units')).toBe(200);
    expect(clientMetricFormat(clientMetricValue(row, 'units'), 'units')).toBe('200 ks');
  });

  it('defaults a missing field to 0 rather than NaN/undefined', () => {
    expect(clientMetricValue({} as ClientVolumeRowDto, 'kg')).toBe(0);
    expect(clientMetricValue({} as ClientVolumeRowDto, 'units')).toBe(0);
  });
});

describe('tonnesAxisTick', () => {
  it('converts kilograms to tonnes without a trailing decimal on whole tonnes', () => {
    // The axis in the screenshot: 0 … 50 000 kg becomes 0 … 50 t.
    expect(tonnesAxisTick(0)).toBe('0');
    expect(tonnesAxisTick(5000)).toBe('5');
    expect(tonnesAxisTick(50000)).toBe('50');
  });

  it('keeps a decimal when the tick is not a whole tonne', () => {
    expect(tonnesAxisTick(12500)).toBe('12,5');
  });

  it('still separates sub-tonne ticks instead of rounding them all to zero', () => {
    // A low-volume period would otherwise collapse every tick to "0" and make the axis
    // unreadable — this is the tradeoff of a fixed-unit axis, so it must hold.
    expect(tonnesAxisTick(800)).toBe('0,8');
    expect(tonnesAxisTick(10)).toBe('0,01');
    expect(tonnesAxisTick(800)).not.toBe(tonnesAxisTick(10));
  });

  it('never mixes units the way fmtKg would on an axis', () => {
    // fmtKg(0) is "0 kg" but fmtKg(5000) is "5,0 t"; the axis must not do that.
    expect(tonnesAxisTick(0)).not.toContain('kg');
    expect(tonnesAxisTick(5000)).not.toContain('t');
  });
});

describe('bandAxisWidth', () => {
  it('reserves far less than the old flat 150 for the short real brewery names', () => {
    // The three names that exposed the bug. A flat 150 left ~85px of dead space and pushed
    // the whole plot right; these must all come back well under it.
    expect(bandAxisWidth(['Rohozec', 'Primátor', 'Svijany'])).toBeLessThan(120);
  });

  it('grows with the longest name, not the first or the count', () => {
    const short = bandAxisWidth(['Svijany']);
    const long = bandAxisWidth(['Svijany', 'Pivovar Chemnitz']);

    expect(long).toBeGreaterThan(short);
    // Order must not matter — only the longest name decides.
    expect(bandAxisWidth(['Pivovar Chemnitz', 'Svijany'])).toBe(long);
  });

  it('never returns less than the floor, even with no breweries or empty names', () => {
    // breweries can be empty while the rest of the tab still has data, so this has to
    // return a usable number rather than a degenerate one.
    expect(bandAxisWidth([])).toBe(56);
    expect(bandAxisWidth(['', '—'])).toBe(56);
  });

  it('caps a pathological name so it cannot eat the plot area', () => {
    expect(bandAxisWidth(['Pivovar '.repeat(20)])).toBe(150);
  });

  it('honours a per-chart cap — client names run longer than region names', () => {
    const long = ['Restaurace U Zlatého Tygra v Praze'];

    expect(bandAxisWidth(long, 170)).toBe(170);
    expect(bandAxisWidth(long, 130)).toBe(130);
    // The cap is an upper bound, not a fixed width: a short name ignores it entirely.
    expect(bandAxisWidth(['Praha'], 170)).toBe(56);
  });
});

describe('PERIOD_LABEL', () => {
  it('matches the prototype wording', () => {
    expect(PERIOD_LABEL['30']).toBe('posledních 30 dní');
    expect(PERIOD_LABEL['90']).toBe('posledních 90 dní');
    expect(PERIOD_LABEL['180']).toBe('posledních 6 měsíců');
  });
});
