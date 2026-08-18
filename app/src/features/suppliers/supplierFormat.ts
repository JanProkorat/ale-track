// Address formatting shared by the suppliers list and detail, so the Sídlo column and the
// address card cannot drift apart.

import { type AddressDto } from 'src/generated/api-client';

/** "46001" → "460 01"; anything that is not five digits is left as typed. */
export function formatZip(zip?: string): string {
  const z = (zip ?? '').replace(/\s/g, '');
  return /^\d{5}$/.test(z) ? `${z.slice(0, 3)} ${z.slice(3)}` : (zip ?? '');
}

/** One-line address for a table cell: "Londýnská 564, 460 11 Liberec". */
export function addressOneLine(a?: AddressDto): string {
  if (!a) return '—';
  return `${a.streetName ?? ''} ${a.streetNumber ?? ''}, ${formatZip(a.zip)} ${a.city ?? ''}`
    .replace(/\s+/g, ' ')
    .trim();
}
