// Pure shaping for the Reporty screens: the period presets, the date window they
// resolve to, and the number formats the prototype uses. Kept out of the
// components so the arithmetic is testable without rendering. No React, no
// component imports — see app/CLAUDE.md's convention for feature-local pure
// modules (shipmentInvoiceModel.ts).
import { num } from 'src/lib/format';
import { ReportGranularity } from 'src/generated/api-client';

export type ReportTab = 'volume' | 'clients' | 'operational';
export type ReportPeriod = '30' | '90' | '180';

/** The Objem tab's trend granularity — the prototype's Týdně/Měsíčně toggle. */
export type VolumeGranularity = 'week' | 'month';

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
