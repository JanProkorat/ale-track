import { describe, expect, it } from 'vitest';
import { SaleBuyerKind, SalePaymentMethod } from 'src/generated/api-client';
import {
  buyerKindLabel,
  discountShare,
  fmtDaysOfCover,
  overdueTone,
  paymentLabel,
  SALES_PERIOD_LABEL,
  SALES_TAB_OPTIONS,
} from './salesReportModel';

describe('fmtDaysOfCover', () => {
  // "Never sold" is a different fact from "a very long cover" — it must not render as a number.
  it('renders an em dash when nothing sold', () => {
    expect(fmtDaysOfCover(null)).toBe('—');
    expect(fmtDaysOfCover(undefined)).toBe('—');
  });

  it('rounds to whole days', () => {
    expect(fmtDaysOfCover(10.4)).toBe('10 dní');
    expect(fmtDaysOfCover(1.2)).toBe('1 den');
    expect(fmtDaysOfCover(2.6)).toBe('3 dny');
  });

  it('caps a cover that runs past a year rather than printing a nonsense number', () => {
    expect(fmtDaysOfCover(5000)).toBe('> 1 rok');
  });

  it('reports a sub-day cover as less than a day rather than rounding it to zero', () => {
    expect(fmtDaysOfCover(0.3)).toBe('< 1 den');
  });
});

describe('overdueTone', () => {
  it('is neutral while the invoice is within terms', () => {
    expect(overdueTone(-5)).toBe('grey');
    expect(overdueTone(0)).toBe('grey');
  });

  it('warns from the first day past due', () => {
    expect(overdueTone(1)).toBe('amber');
    expect(overdueTone(30)).toBe('amber');
  });

  it('escalates past a month overdue', () => {
    expect(overdueTone(31)).toBe('crit');
  });

  it('is neutral when no due date was agreed', () => {
    expect(overdueTone(null)).toBe('grey');
  });
});

describe('discountShare', () => {
  it('formats the share of list value given away', () => {
    expect(discountShare(0.0625)).toBe('6,3 %');
  });

  it('is safe on a zero share', () => {
    expect(discountShare(0)).toBe('0,0 %');
  });
});

describe('labels', () => {
  it('names both payment methods in Czech', () => {
    expect(paymentLabel(SalePaymentMethod.Cash)).toBe('Hotově');
    expect(paymentLabel(SalePaymentMethod.Invoice)).toBe('Faktura');
  });

  // Enums arrive as strings on the wire even though the client types them numeric.
  it('names a payment method that arrives as a string', () => {
    expect(paymentLabel('Invoice' as unknown as SalePaymentMethod)).toBe('Faktura');
  });

  // Matches the wording the sale editor already uses for the same choice.
  it('names both buyer kinds in Czech', () => {
    expect(buyerKindLabel(SaleBuyerKind.Client)).toBe('Klient');
    expect(buyerKindLabel(SaleBuyerKind.Walkin)).toBe('Jednorázový kupující');
  });

  it('names a buyer kind that arrives as a string', () => {
    expect(buyerKindLabel('Walkin' as unknown as SaleBuyerKind)).toBe('Jednorázový kupující');
  });

  it('offers the three tabs and every period preset', () => {
    expect(SALES_TAB_OPTIONS.map((t) => t.value)).toEqual(['revenue', 'products', 'buyers']);
    expect(Object.keys(SALES_PERIOD_LABEL)).toEqual(['30', '90', '180']);
  });
});
