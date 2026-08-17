// Pure arithmetic and row-shaping for the bulk catalog price editor
// (BulkClientPricesDrawer, Task 10's "Hromadná úprava cen"). Kept out of the
// component per app/CLAUDE.md: this is the risky part — a percentage fill
// that must be idempotent, and the row marks that catch a raise a percentage
// fill can introduce across the whole catalog — and it is testable without a
// rendering harness.

import { ClientProductPriceEntryDto } from 'src/generated/api-client';

/** The minimal product shape the model needs: the ceník price to fill and
 * revert against. */
export interface BulkPriceProduct {
  id: string;
  priceWithVat: number;
}

/**
 * Fills every product's draft value from its own ceník price, never from the
 * client's current price. That is what makes a second run land on the same
 * numbers instead of compounding a discount or an increase — the cost is
 * that it can raise a price the client already has (their existing discount
 * was deeper than the percentage applied), which {@link rowState} flags via
 * `raisesPrice` rather than letting it pass quietly.
 */
export function fillFromPercent(products: BulkPriceProduct[], percent: number): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const product of products) {
    draft[product.id] = String(Math.round(product.priceWithVat * (1 + percent / 100)));
  }
  return draft;
}

/** The three row badges the catalog table renders: `nová`, `⚠ vyšší než
 * dnes`, `vrátí se na ceník`. */
export interface RowMarks {
  /** The client has no price for this product yet, and the draft sets one. */
  isNew: boolean;
  /** The draft value is above what the client pays today. */
  raisesPrice: boolean;
  /** The client had a price and the draft has been cleared: saving removes
   * it, so the product reverts to the ceník price. */
  revertsToList: boolean;
}

/**
 * Row state for one product, given its current draft text and the client's
 * existing price (`undefined` when the client has none). An empty or
 * unparseable draft carries none of the marks that require a valid value.
 */
export function rowState(
  _product: BulkPriceProduct,
  draftValue: string,
  currentPrice: number | undefined,
): RowMarks {
  const trimmed = draftValue.trim();
  const parsed = trimmed === '' ? undefined : parseFloat(trimmed);
  const hasValidDraft = parsed != null && Number.isFinite(parsed);

  return {
    isNew: hasValidDraft && currentPrice == null,
    raisesPrice: hasValidDraft && currentPrice != null && parsed! > currentPrice,
    revertsToList: trimmed === '' && currentPrice != null,
  };
}

/**
 * The complete desired list for the replace endpoint: one entry per product
 * with a valid, positive draft price. A blank field means the client pays
 * the ceník — omitting the entry (rather than sending it with some sentinel
 * value) is how a price is removed, since the endpoint replaces the whole
 * list instead of patching it. An unparseable or non-positive amount is
 * dropped rather than written, so a stray character cannot silently zero out
 * a price.
 */
export function toReplacePayload(draft: Record<string, string>): ClientProductPriceEntryDto[] {
  const entries: ClientProductPriceEntryDto[] = [];
  for (const [productId, raw] of Object.entries(draft)) {
    if (raw.trim() === '') {
      continue;
    }
    const price = parseFloat(raw);
    if (!Number.isFinite(price) || price <= 0) {
      continue;
    }
    entries.push(new ClientProductPriceEntryDto({ productId, priceWithVat: price }));
  }
  return entries;
}
