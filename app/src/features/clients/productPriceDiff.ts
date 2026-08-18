// The difference between a client's own price and the brewery's ceník price.
// A struck-through number tells you a price is special but not by how much, so
// the pill in the Ceník tab's Rozdíl column is the amount someone is actually
// checking. Pure, and in its own module so the three outcomes can be covered
// without a rendering harness — and so the panel file exports only components.

export type PriceDiff = { amount: number; direction: 'lower' | 'higher' | 'equal' };

/** Compares a client's price against the ceník price it stands in for. */
export function computePriceDiff(clientPrice: number, listPrice: number): PriceDiff {
  const amount = clientPrice - listPrice;
  if (amount === 0) return { amount: 0, direction: 'equal' };
  return { amount: Math.abs(amount), direction: amount < 0 ? 'lower' : 'higher' };
}
