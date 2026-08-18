// What the Košík card shows: every line of every stop, flattened, priced and labelled. Pure, so the
// interesting part — which catalogue a line is priced from, and what happens when that catalogue
// has not loaded — is testable without rendering the editor.

import type { BreweryProductListItemDto, SupplierDto } from 'src/generated/api-client';
import { chargeKindLabel, chargeKindName, kindLabel } from 'src/lib/labels';
import { fmtLiters } from 'src/lib/format';
import type { DraftLine, DraftStop } from './deliveryDraft';
import { lineKey } from './deliveryDraft';
import { SUPPLIER_COLOR } from './stopVisuals';

/** One row of the cart. */
export interface CartRow {
  /** Identifies the row across a re-render, and says which stop's line to edit. */
  key: string;
  stopKey: string;
  line: DraftLine;
  name: string;
  /** The dot's colour: the brewery's own, or the one fixed supplier tone. */
  color: string;
  /** The middle line, already ordered — kind/size for a product, charge kind/size for a good. */
  details: string[];
  /** Price with VAT for one unit, or null when the catalogue has not loaded yet. */
  unitPrice: number | null;
  quantity: number;
  note: string;
}

export interface CartCatalogues {
  /** Each brewery stop's ceník, by brewery id. */
  byBrewery: Map<string, BreweryProductListItemDto[]>;
  /** Each supplier stop's detail — including its price list — by supplier id. */
  bySupplier: Map<string, SupplierDto>;
  /** A brewery's colour, by brewery id. */
  breweryColor: Map<string, string | undefined>;
}

/**
 * Flattens every stop's lines into cart rows, in stop order then line order.
 *
 * A line whose catalogue has not loaded still gets a row, with a null price: dropping it would make
 * the cart's count disagree with the stop cards while a fetch is in flight, and a line the user
 * added visibly vanishing is worse than one whose price arrives a moment later.
 */
export function buildCartRows(stops: DraftStop[], catalogues: CartCatalogues): CartRow[] {
  const rows: CartRow[] = [];

  for (const stop of stops) {
    for (const line of stop.items) {
      const key = `${stop.key}:${lineKey(line)}`;
      const base = { key, stopKey: stop.key, line, quantity: line.quantity, note: line.note ?? '' };

      if (line.source === 'product') {
        const product = (catalogues.byBrewery.get(stop.breweryId) ?? [])
          .find((p) => p.id === line.productId);
        rows.push({
          ...base,
          name: product?.name ?? '—',
          color: catalogues.breweryColor.get(stop.breweryId) ?? '#7C3AED',
          details: [
            kindLabel(product?.kind),
            product?.packageSize != null ? fmtLiters(product.packageSize) : undefined,
          ].filter((d): d is string => Boolean(d)),
          unitPrice: product?.priceWithVat ?? null,
        });
        continue;
      }

      const good = (catalogues.bySupplier.get(stop.supplierId)?.goods ?? [])
        .find((g) => g.id === line.supplierGoodId);
      // The price for this line's charge kind, not the good's first: a bottle refilled and the same
      // bottle rented are separate rows, and pricing both from whichever came first would put the
      // wrong number on one of them. Matched by name, because the good's prices always arrive as
      // wire strings while a line the user just added holds the numeric enum member.
      const wanted = chargeKindName(line.chargeKind);
      const price = (good?.prices ?? []).find((p) => chargeKindName(p.kind) === wanted);
      rows.push({
        ...base,
        name: good?.name ?? '—',
        color: SUPPLIER_COLOR,
        details: [chargeKindLabel(line.chargeKind), good?.size ?? undefined]
          .filter((d): d is string => Boolean(d)),
        unitPrice: price?.priceWithVat ?? null,
      });
    }
  }

  return rows;
}

/** Total number of units in the cart — the "3 ks" chip in the card's head. */
export function cartTotalQuantity(rows: CartRow[]): number {
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

/**
 * Total price with VAT.
 *
 * Rows whose catalogue has not loaded contribute nothing rather than blocking the total: a partial
 * sum that grows as fetches land reads as a total still settling, which is what it is.
 */
export function cartTotalPrice(rows: CartRow[]): number {
  return rows.reduce((sum, r) => sum + (r.unitPrice ?? 0) * r.quantity, 0);
}
