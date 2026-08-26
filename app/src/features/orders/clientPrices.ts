// The client's own prices for products that are not on the order.
//
// A product taken at the door has no order line, so it has no price on the order either. The
// history endpoint already resolves the client's price list across the whole catalog before it
// splits the result into "recent" and the brewery tree, so flattening that response gives the
// price this client actually pays — the same figure the order editor would put on the line if the
// product had been ordered. The catalog price is not a substitute: billing a client with an
// override the list price has been a defect here before.

import type { GroupedProductHistoryDto, ProductListItemDto } from 'src/generated/api-client';

/**
 * Every product in the history response, keyed by product id.
 *
 * The two halves of the response are disjoint — the brewery tree excludes what is already in
 * `recent` — but `recent` is read first anyway, so a product appearing in both resolves to one
 * entry rather than depending on iteration order.
 */
export function catalogByProductId(history?: GroupedProductHistoryDto): Map<string, ProductListItemDto> {
  const byId = new Map<string, ProductListItemDto>();

  const add = (item: ProductListItemDto) => {
    if (item.id && !byId.has(item.id)) byId.set(item.id, item);
  };

  for (const item of history?.recent ?? []) add(item);

  for (const brewery of history?.breweries ?? []) {
    for (const kind of brewery.kinds ?? []) {
      for (const size of kind.packageSizes ?? []) {
        for (const item of size.items ?? []) add(item);
      }
    }
  }

  return byId;
}
