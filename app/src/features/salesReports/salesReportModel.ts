// Pure shaping for the Garážový prodej report screens: the tab and period tables plus the
// formatting the tabs share. Kept out of the components so the arithmetic is testable
// without rendering — same convention as reports/reportModel.ts and shipmentInvoiceModel.ts.
import { L, salePaymentName, saleBuyerKindName, type StatusTone } from 'src/lib/labels';
import { plural } from 'src/lib/format';
import type { SaleBuyerKind, SalePaymentMethod } from 'src/generated/api-client';

export type SalesReportTab = 'revenue' | 'products' | 'buyers';

/** Reused from the shipment Reporty so both report screens offer the same windows. */
export type SalesReportPeriod = '30' | '90' | '180';

export const SALES_TAB_OPTIONS = [
  { value: 'revenue' as const, label: 'Tržby' },
  { value: 'products' as const, label: 'Zboží' },
  { value: 'buyers' as const, label: 'Kupující' },
];

export const SALES_PERIOD_LABEL: Record<SalesReportPeriod, string> = {
  '30': 'posledních 30 dní',
  '90': 'posledních 90 dní',
  '180': 'posledních 6 měsíců',
};

/**
 * How overdue an invoice reads, in the theme's own status tones so the pill matches every
 * other status in the app. Null days means no due date was agreed, so there is nothing to be
 * late against — neutral, not alarming.
 */
export function overdueTone(daysOverdue: number | null | undefined): StatusTone {
  if (daysOverdue == null || daysOverdue <= 0) return 'grey';
  return daysOverdue > 30 ? 'crit' : 'amber';
}

/**
 * Days of cover in Czech. Null means the item never sold in the window — rendered as a dash,
 * because "never sold" is a different fact from "a very long cover" and must not read as one.
 * A cover past a year is capped for the same reason: the precise number is noise once the
 * answer is "this is not moving".
 */
export function fmtDaysOfCover(days: number | null | undefined): string {
  if (days == null) return '—';
  if (days > 365) return '> 1 rok';

  const whole = Math.round(days);
  if (whole < 1) return '< 1 den';

  return `${whole} ${plural(whole, 'den', 'dny', 'dní')}`;
}

/** A 0–1 share as a Czech percentage with one forced decimal. */
export function discountShare(share: number): string {
  return `${new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(share * 100)} %`;
}

/** Czech name of a payment method, from either wire representation. */
export function paymentLabel(payment: SalePaymentMethod | string | number | undefined): string {
  return L.salePayment[salePaymentName(payment)] ?? '—';
}

/** Czech name of a buyer kind, from either wire representation. */
export function buyerKindLabel(buyerKind: SaleBuyerKind | string | number | undefined): string {
  return L.saleBuyerKind[saleBuyerKindName(buyerKind)] ?? '—';
}
