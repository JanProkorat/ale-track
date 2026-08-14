// Shaping logic behind the sale editor's stock catalog. Kept out of the components so the ordering
// and grouping rules are testable without a rendering harness — the orderCatalogModel.ts precedent.

import { compareProductsForDisplay } from 'src/lib/productSort';
import {
  type InventorySectionDto,
  type ProductKind,
  type ProductType,
} from 'src/generated/api-client';

/**
 * A sellable stock row with the brewery section it came from.
 *
 * Declared structurally rather than as `InventoryItemListItemDto & {…}`: the generated DTO is a
 * class, so an intersection would demand its `init`/`toJSON` methods on every row we build by
 * spreading. These rows are display-only and never sent back, so the fields are all we need — the
 * same reasoning as `SaleRowLike` in salesModel.ts.
 */
export interface StockRow {
  id?: string;
  name?: string;
  quantity?: number;
  kind?: ProductKind;
  type?: ProductType;
  platoDegree?: number;
  packageSize?: number;
  priceWithVat?: number;
  /** Brewery public id, or empty for hand-kept rows — resolves the section's colour swatch. */
  sectionId: string;
  /** Brewery name, or "Ostatní" for hand-kept rows — the section heading it renders under. */
  sectionName: string;
}

/** Same-name rows clustered into one card, one line per size variant. */
export interface StockGroup {
  name: string;
  items: StockRow[];
}

/**
 * Flattens the brewery-grouped list endpoint into sellable rows.
 *
 * Rows at zero are dropped rather than shown disabled: the catalog exists to add goods to a sale,
 * and an item that cannot be sold is noise in it. Sklad is where out-of-stock rows belong.
 */
export function sellableRows(sections: InventorySectionDto[] | undefined): StockRow[] {
  const rows: StockRow[] = [];
  for (const section of sections ?? []) {
    for (const item of section.items ?? []) {
      if (!item.id || (item.quantity ?? 0) <= 0) continue;
      rows.push({ ...item, sectionId: section.id ?? '', sectionName: section.name ?? 'Ostatní' });
    }
  }
  return rows;
}

/** Filters rows by a free-text needle over the item name. Empty needle keeps everything. */
export function searchRows(rows: StockRow[], search: string): StockRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => (row.name ?? '').toLowerCase().includes(needle));
}

/**
 * Groups rows by name so same-name/different-size variants cluster into one card, in first-seen
 * order — mirrors `groupByName` in the order editor's catalog.
 *
 * First-seen order carries the incoming sort through: the list endpoint already returns rows in
 * display order, so the groups come out in display order too.
 */
export function groupRowsByName(rows: StockRow[]): StockGroup[] {
  const order: string[] = [];
  const byName = new Map<string, StockRow[]>();
  for (const row of rows) {
    const name = row.name ?? '';
    if (!byName.has(name)) {
      byName.set(name, []);
      order.push(name);
    }
    byName.get(name)!.push(row);
  }
  return order.map((name) => ({ name, items: byName.get(name)! }));
}

/** One brewery's worth of catalog: its identity, its grouped rows and how many rows it holds. */
export interface CatalogSection {
  id: string;
  name: string;
  groups: StockGroup[];
  itemCount: number;
}

/** Splits rows into their brewery sections, preserving the endpoint's section order. */
export function bySection(rows: StockRow[]): CatalogSection[] {
  const order: string[] = [];
  const bySectionName = new Map<string, StockRow[]>();
  for (const row of rows) {
    if (!bySectionName.has(row.sectionName)) {
      bySectionName.set(row.sectionName, []);
      order.push(row.sectionName);
    }
    bySectionName.get(row.sectionName)!.push(row);
  }
  return order.map((name) => {
    const sectionRows = bySectionName.get(name)!;
    return {
      id: sectionRows[0].sectionId,
      name,
      groups: groupRowsByName(sectionRows),
      itemCount: sectionRows.length,
    };
  });
}

/** A previously-sold item joined to the stock row it can be re-added from. */
export interface HistoryRow extends StockRow {
  lastSoldDate?: string | Date;
  lastUnitPriceWithVat?: number;
  lastQuantity?: number;
}

/**
 * Joins the client's purchase history onto the live stock rows.
 *
 * The history endpoint reports what was sold; the catalog can only offer what is still on the shelf,
 * so a remembered item whose stock ran out simply is not suggested. Re-sorted into display order
 * because the endpoint returns it newest-first, which would otherwise make the two tabs disagree on
 * where the same beer sits.
 */
export function historyRows(
  history: { inventoryItemId?: string; lastSoldDate?: string | Date; lastUnitPriceWithVat?: number; lastQuantity?: number }[] | undefined,
  stock: StockRow[]
): HistoryRow[] {
  const byId = new Map(stock.map((row) => [row.id ?? '', row]));

  const joined: HistoryRow[] = [];
  for (const entry of history ?? []) {
    const row = entry.inventoryItemId ? byId.get(entry.inventoryItemId) : undefined;
    if (!row) continue;
    joined.push({
      ...row,
      lastSoldDate: entry.lastSoldDate,
      lastUnitPriceWithVat: entry.lastUnitPriceWithVat,
      lastQuantity: entry.lastQuantity,
    });
  }

  return joined.sort(compareProductsForDisplay);
}
