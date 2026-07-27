// Pure shaping for the Reporty screens: the period presets, the date window they
// resolve to, and the number formats the prototype uses. Kept out of the
// components so the arithmetic is testable without rendering. No React, no
// component imports — see app/CLAUDE.md's convention for feature-local pure
// modules (shipmentInvoiceModel.ts).
import { num } from 'src/lib/format';
import { ReportGranularity, type ClientVolumeRowDto } from 'src/generated/api-client';

export type ReportTab = 'volume' | 'clients' | 'operational';
export type ReportPeriod = '30' | '90' | '180';

/** The Objem tab's trend granularity — the prototype's Týdně/Měsíčně toggle. */
export type VolumeGranularity = 'week' | 'month';

/** The Klienti tab's top-clients chart metric — the prototype's Hmotnost/Kusy toggle
 * (`REP.cMetric`, aletrack-prototype.html:916). */
export type ClientMetric = 'kg' | 'units';

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  '30': 'posledních 30 dní',
  '90': 'posledních 90 dní',
  '180': 'posledních 6 měsíců',
};

export const TAB_OPTIONS = [
  { value: 'volume' as const, label: 'Objem' },
  { value: 'clients' as const, label: 'Klienti' },
  { value: 'operational' as const, label: 'Provoz' },
];

export const PERIOD_OPTIONS = [
  { value: '30' as const, label: '30 dní' },
  { value: '90' as const, label: '90 dní' },
  { value: '180' as const, label: '6 měsíců' },
];

export const GRANULARITY_OPTIONS = [
  { value: 'week' as const, label: 'Týdně' },
  { value: 'month' as const, label: 'Měsíčně' },
];

export const METRIC_OPTIONS = [
  { value: 'kg' as const, label: 'Hmotnost' },
  { value: 'units' as const, label: 'Kusy' },
];

/** Maps the UI's granularity choice onto the generated numeric enum. */
export function apiGranularity(g: VolumeGranularity): ReportGranularity {
  return g === 'month' ? ReportGranularity.Month : ReportGranularity.Week;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Exactly one decimal place, cs-CZ — the prototype's `nf(n, 1)`, which sets both the
 * minimum and maximum fraction digits, so 2 t renders as "2,0 t" and not "2 t".
 * `num()` from src/lib/format forces no decimals and has many other callers, so this
 * stays local rather than changing that. */
function num1(n: number): string {
  return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

/** The window a period preset resolves to — `to` is today, `from` is N days earlier.
 *
 * The anchor is the caller's *local* calendar day (that is what "last 30 days" means to
 * them) mapped onto UTC midnight, so the ISO output cannot slip a day: reading local
 * date parts while doing the arithmetic and formatting in UTC put `to` a day behind for
 * anyone east of Greenwich between local midnight and their UTC offset. */
export function periodRange(period: ReportPeriod, today: Date = new Date()): { from: string; to: string } {
  const to = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - Number(period));
  return { from: isoDate(from), to: isoDate(to) };
}

/** Weight in the prototype's format: tonnes with one forced decimal from 1000 kg up,
 * whole kilograms below it. Matches `fmtKg` in the prototype (line 793). */
export function fmtKg(kg: number): string {
  return kg >= 1000 ? `${num1(kg / 1000)} t` : `${num(Math.round(kg))} kg`;
}

/** A part's share of a total, one forced decimal, safe on a zero total. */
export function sharePct(part: number, total: number): string {
  return `${num1(total > 0 ? (part / total) * 100 : 0)} %`;
}

/** Units in the prototype's format: a whole count with the "ks" (kusů) suffix. */
export function fmtUnits(units: number): string {
  return `${num(units)} ks`;
}

/** The Klienti tab's top-clients metric selector, pulled out of the component so the
 * mapping is directly unit-testable — @mui/x-charts' own rendered bar values are not
 * observable under happy-dom (no ResizeObserver-driven layout, so the numeric axis
 * renders no ticks at all), so a component test alone cannot prove a metric switch
 * actually changed the plotted values. */
export function clientMetricValue(row: ClientVolumeRowDto, metric: ClientMetric): number {
  return metric === 'kg' ? (row.weightKg ?? 0) : (row.units ?? 0);
}

/** Formats a top-clients value per the selected metric — `fmtKg` for weight, `fmtUnits`
 * for a raw count. Paired with `clientMetricValue`. */
export function clientMetricFormat(value: number, metric: ClientMetric): string {
  return metric === 'kg' ? fmtKg(value) : fmtUnits(value);
}

/** Short Czech month abbreviations, 1-indexed so `MONTH_ABBR[d.getMonth() + 1]` lines up
 * directly with `Date#getMonth()` — index 0 is an unused placeholder. Matches the
 * prototype's inline array (aletrack-prototype.html:795). Exported so Task 7's Provoz
 * dovoz/vývoz chart can reuse the same abbreviations. */
export const MONTH_ABBR = [
  '',
  'led',
  'úno',
  'bře',
  'dub',
  'kvě',
  'čvn',
  'čvc',
  'srp',
  'zář',
  'říj',
  'lis',
  'pro',
] as const;

/** Trend-bucket label matching the prototype's `repBucketLabel` (aletrack-prototype.html:
 * 794-796): month buckets render as the short Czech abbreviation, day/week buckets as
 * `D.M.` with no spaces (e.g. "20.7."). The wire DTO's `bucketStart` is always a `Date`
 * once parsed by the generated client, but tests construct it from a plain ISO string, so
 * both wire forms are accepted here; which format applies is driven by the caller's
 * chosen granularity, not by inspecting the value itself (unlike the prototype, which
 * sniffed a `YYYY-MM` string key — our bucket is always a full date, even for month
 * buckets, so sniffing would not work). */
export function bucketLabel(bucketStart: string | Date | undefined, granularity: VolumeGranularity): string {
  if (!bucketStart) return '—';
  const d = new Date(bucketStart);
  if (Number.isNaN(d.getTime())) return '—';
  return granularity === 'month' ? (MONTH_ABBR[d.getMonth() + 1] ?? '—') : `${d.getDate()}.${d.getMonth() + 1}.`;
}
