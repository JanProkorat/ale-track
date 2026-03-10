import { currencySymbol, CURRENCY_SYMBOLS } from './CurrencyProvider';

// ---------------------------------------------------------------------------
// currencySymbol
// ---------------------------------------------------------------------------

describe('currencySymbol', () => {
     it('returns Kč for CZK', () => {
          expect(currencySymbol('CZK')).toBe('Kč');
     });

     it('returns € for EUR', () => {
          expect(currencySymbol('EUR')).toBe('€');
     });

     it('returns the code itself for unknown currencies', () => {
          expect(currencySymbol('USD')).toBe('USD');
     });

     it('returns empty string for empty input', () => {
          expect(currencySymbol('')).toBe('');
     });
});

// ---------------------------------------------------------------------------
// CURRENCY_SYMBOLS
// ---------------------------------------------------------------------------

describe('CURRENCY_SYMBOLS', () => {
     it('contains CZK and EUR entries', () => {
          expect(CURRENCY_SYMBOLS).toEqual({ CZK: 'Kč', EUR: '€' });
     });
});

// ---------------------------------------------------------------------------
// getInitialCurrency logic (via localStorage mock)
// ---------------------------------------------------------------------------

describe('getInitialCurrency logic', () => {
     type CurrencyCode = 'CZK' | 'EUR';

     const STORAGE_KEY = 'preferredCurrency';

     function getInitialCurrency(): CurrencyCode {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored === 'EUR' || stored === 'CZK') return stored;
          return 'CZK';
     }

     beforeEach(() => {
          localStorage.clear();
     });

     it('returns CZK when nothing is stored', () => {
          expect(getInitialCurrency()).toBe('CZK');
     });

     it('returns EUR when EUR is stored', () => {
          localStorage.setItem(STORAGE_KEY, 'EUR');
          expect(getInitialCurrency()).toBe('EUR');
     });

     it('returns CZK when CZK is stored', () => {
          localStorage.setItem(STORAGE_KEY, 'CZK');
          expect(getInitialCurrency()).toBe('CZK');
     });

     it('returns CZK when an invalid value is stored', () => {
          localStorage.setItem(STORAGE_KEY, 'GBP');
          expect(getInitialCurrency()).toBe('CZK');
     });
});

// ---------------------------------------------------------------------------
// Currency conversion math
// ---------------------------------------------------------------------------

describe('currency conversion math', () => {
     type CurrencyCode = 'CZK' | 'EUR';

     const convert = (czk: number, currency: CurrencyCode, eurRate: number | null): number => {
          if (currency === 'CZK' || !eurRate) return czk;
          return czk / eurRate;
     };

     const toCzk = (amount: number, currency: CurrencyCode, eurRate: number | null): number => {
          if (currency === 'CZK' || !eurRate) return amount;
          return amount * eurRate;
     };

     const formatPrice = (
          czk: number | undefined | null,
          currency: CurrencyCode,
          eurRate: number | null,
     ): string => {
          if (czk == null) return '-';
          const value = convert(czk, currency, eurRate);
          const symbols: Record<CurrencyCode, string> = { CZK: 'Kč', EUR: '€' };
          return `${value.toFixed(2)} ${symbols[currency]}`;
     };

     describe('convert', () => {
          it('returns input unchanged when currency is CZK', () => {
               expect(convert(100, 'CZK', 25)).toBe(100);
          });

          it('divides by eurRate when currency is EUR', () => {
               expect(convert(100, 'EUR', 25)).toBe(4);
          });

          it('returns input unchanged when eurRate is null', () => {
               expect(convert(100, 'EUR', null)).toBe(100);
          });
     });

     describe('toCzk', () => {
          it('returns input unchanged when currency is CZK', () => {
               expect(toCzk(4, 'CZK', 25)).toBe(4);
          });

          it('multiplies by eurRate when currency is EUR', () => {
               expect(toCzk(4, 'EUR', 25)).toBe(100);
          });

          it('returns input unchanged when eurRate is null', () => {
               expect(toCzk(4, 'EUR', null)).toBe(4);
          });
     });

     describe('formatPrice', () => {
          it('returns "-" for null', () => {
               expect(formatPrice(null, 'CZK', null)).toBe('-');
          });

          it('returns "-" for undefined', () => {
               expect(formatPrice(undefined, 'CZK', null)).toBe('-');
          });

          it('formats CZK price correctly', () => {
               expect(formatPrice(100, 'CZK', null)).toBe('100.00 Kč');
          });

          it('formats EUR price correctly with conversion', () => {
               expect(formatPrice(100, 'EUR', 25)).toBe('4.00 €');
          });
     });
});
