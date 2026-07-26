// Pure shaping for the Reporty screens: the period presets, the date window they
// resolve to, and the number formats the prototype uses. Kept out of the
// components so the arithmetic is testable without rendering. No React, no
// component imports — see app/CLAUDE.md's convention for feature-local pure
// modules (shipmentInvoiceModel.ts).
import { num } from 'src/lib/format';

export type ReportTab = 'volume' | 'clients' | 'operational';
export type ReportPeriod = '30' | '90' | '180';

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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The window a period preset resolves to — `to` is today, `from` is N days earlier. */
export function periodRange(period: ReportPeriod, today: Date = new Date()): { from: string; to: string } {
  const to = new Date(today);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - Number(period));
  return { from: isoDate(from), to: isoDate(to) };
}

/** Weight in the prototype's format: tonnes with one decimal from 1000 kg up. */
export function fmtKg(kg: number): string {
  return kg >= 1000 ? `${num(Math.round((kg / 1000) * 10) / 10)} t` : `${num(Math.round(kg))} kg`;
}

/** A part's share of a total, one decimal, safe on a zero total. */
export function sharePct(part: number, total: number): string {
  const pct = total > 0 ? (part / total) * 100 : 0;
  return `${num(Math.round(pct * 10) / 10)} %`;
}
