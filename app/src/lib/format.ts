// Formatting helpers (money lives on CurrencyProvider since it's currency-aware).

export function num(n: number): string {
  return new Intl.NumberFormat('cs-CZ').format(n);
}

export function fmtLiters(x: number | null | undefined): string {
  return x == null ? '—' : `${x.toLocaleString('cs-CZ')} l`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateShort(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

export function initials(a?: string, b?: string): string {
  return `${(a || ' ')[0]}${b ? b[0] : ''}`.toUpperCase().trim() || '?';
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}
