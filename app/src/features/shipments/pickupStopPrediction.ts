// Which pickup stops a run needs, worked out on the client so the stop list and the map move on
// the click rather than after the run is re-read.
//
// The server is still the authority: every sourcing write reconciles the stops itself and the
// refetch that follows replaces whatever this predicted. This exists only to spare the operator a
// round trip's wait, and it deliberately answers the same two questions the backend asks —
// SupplierPickupStopReconciler and CompanyStopReconciler are the counterparts, and their tests and
// this module's tests cover the same cases so a change to one shows up as a failure against the
// other's expectations.

import {
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
  type OutgoingShipmentSupplierGoodDto,
} from 'src/generated/api-client';
import { stopKindName } from 'src/lib/labels';

/** Where the warehouse stop is, when one has to be invented. */
export interface CompanyPoint {
  name?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * The least a good line has to say for the two rules to be applied to it.
 *
 * A structural type rather than one of the DTOs, because two screens ask the same question about
 * different shapes: the detail screen about the run's own supplier goods, the editor about the
 * lines of an order it is considering adding. Both carry these fields under these names.
 */
export interface PickupCandidate {
  quantity?: number;
  quantityFromGarage?: number;
  supplierId?: string;
  supplierName?: string;
  supplierAddress?: { latitude?: number; longitude?: number } | undefined;
}

/** A supplier the run has to call at, and where. */
export interface PickupSupplier {
  supplierId: string;
  supplierName?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * The suppliers that need a stop: one per supplier with any piece still collected there, in name
 * order — the order the server adds them in.
 *
 * The mirror of SupplierPickupStopReconciler's own rule, and the single place the client states
 * it. Two screens ask it; neither restates it.
 */
export function suppliersNeedingPickup(goods: PickupCandidate[]): PickupSupplier[] {
  const bySupplier = new Map<string, PickupSupplier>();

  for (const g of goods) {
    if (!g.supplierId) continue;
    if ((g.quantity ?? 0) - (g.quantityFromGarage ?? 0) <= 0) continue;
    if (bySupplier.has(g.supplierId)) continue;

    bySupplier.set(g.supplierId, {
      supplierId: g.supplierId,
      supplierName: g.supplierName,
      latitude: g.supplierAddress?.latitude,
      longitude: g.supplierAddress?.longitude,
    });
  }

  return [...bySupplier.values()]
    .sort((a, b) => (a.supplierName ?? '').localeCompare(b.supplierName ?? '', 'cs'));
}

/**
 * Whether the warehouse needs a stop: anything bought for stock, or any piece off our own shelf.
 *
 * The mirror of CompanyStopReconciler's condition. An OR, so neither reason may remove the stop on
 * the other's behalf.
 */
export function needsGarageStop(goods: PickupCandidate[], hasStockPurchases: boolean): boolean {
  return hasStockPurchases || goods.some((g) => (g.quantityFromGarage ?? 0) > 0);
}

/**
 * The run's stops as they will stand once these supplier-good splits are saved.
 *
 * Two rules, each the mirror of a backend reconciler:
 *
 * - a supplier needs a stop while any piece of its goods is still being collected there
 *   (`quantity - quantityFromGarage > 0`);
 * - the warehouse needs one while anything is bought for stock, or any piece comes from the
 *   garage.
 *
 * An existing stop keeps its identity and its position — a planner may have put the plnírna
 * deliberately mid-route, and this must not shove it to the end. A new one is appended, as the
 * server appends it.
 */
export function predictPickupStops({
  stops,
  supplierGoods,
  hasStockPurchases,
  company,
}: {
  stops: OutgoingShipmentStopDto[];
  /** The good lines with the split already applied. */
  supplierGoods: OutgoingShipmentSupplierGoodDto[];
  hasStockPurchases: boolean;
  company?: CompanyPoint;
}): OutgoingShipmentStopDto[] {
  const wanted = suppliersNeedingPickup(supplierGoods);
  const needsCompany = needsGarageStop(supplierGoods, hasStockPurchases);

  const kept = stops.filter((s) => {
    const kind = stopKindName(s.kind);
    if (kind === 'Supplier') return wanted.some((w) => w.supplierId === s.supplierId);
    if (kind === 'Company') return needsCompany;
    return true;
  });

  const nextOrder = () => kept.reduce((max, s) => Math.max(max, s.order ?? 0), 0) + 1;

  for (const supplier of wanted) {
    if (kept.some((s) => stopKindName(s.kind) === 'Supplier' && s.supplierId === supplier.supplierId)) continue;

    kept.push(new OutgoingShipmentStopDto({
      // No id: this stop does not exist yet. Every consumer treats a missing id as "not
      // addressable" — the reorder controls hide, which is right for a stop the server has
      // not acknowledged.
      kind: OutgoingShipmentStopKind.Supplier,
      order: nextOrder(),
      label: supplier.supplierName,
      supplierId: supplier.supplierId,
      latitude: supplier.latitude,
      longitude: supplier.longitude,
      products: [],
      returns: [],
      customExtraItems: [],
      notes: [],
    }));
  }

  const hasCompany = kept.some((s) => stopKindName(s.kind) === 'Company');

  if (needsCompany && !hasCompany) {
    kept.push(new OutgoingShipmentStopDto({
      kind: OutgoingShipmentStopKind.Company,
      order: nextOrder(),
      label: company?.name,
      latitude: company?.latitude,
      longitude: company?.longitude,
      products: [],
      returns: [],
      customExtraItems: [],
      notes: [],
    }));
  }

  return kept;
}

/** The good lines with one line's split changed, for feeding the prediction. */
export function withSplitApplied(
  supplierGoods: OutgoingShipmentSupplierGoodDto[],
  itemId: string,
  quantityFromGarage: number,
): OutgoingShipmentSupplierGoodDto[] {
  return supplierGoods.map((g) => (g.id === itemId
    ? Object.assign(
      Object.create(Object.getPrototypeOf(g)) as OutgoingShipmentSupplierGoodDto,
      g,
      { quantityFromGarage },
    )
    : g));
}
