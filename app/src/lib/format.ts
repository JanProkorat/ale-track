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

/** "HH:mm" from a Date's local hour/minute (24h, zero-padded). */
export function fmtTime(d: Date | null | undefined): string {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}

/** Short, stable "order number" surrogate — OrderDto carries no `number` field
 * (unlike the design prototype's `OBJ-2026-###`), so the tail of the id stands
 * in for one, shown in mono like the prototype's order number chip. */
export function orderNumber(id?: string): string {
  if (!id) return '—';
  return `#${id.slice(-6).toUpperCase()}`;
}

/** Short display number for a product delivery, derived from its id (the API
 * has no stored delivery number) — same convention as orderNumber. */
export function deliveryNumber(id?: string): string {
  if (!id) return '—';
  return `#${id.slice(-6).toUpperCase()}`;
}

/** Short display number for an outgoing shipment, derived from its id — same
 * convention as orderNumber/deliveryNumber. */
export function shipmentNumber(id?: string): string {
  if (!id) return '—';
  return `#${id.slice(-6).toUpperCase()}`;
}
