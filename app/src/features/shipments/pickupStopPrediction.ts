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
  const kept = stops.filter((s) => {
    const kind = stopKindName(s.kind);
    if (kind === 'Supplier') {
      return supplierGoods.some((g) => g.supplierId === s.supplierId
        && (g.quantity ?? 0) - (g.quantityFromGarage ?? 0) > 0);
    }
    if (kind === 'Company') {
      return hasStockPurchases || supplierGoods.some((g) => (g.quantityFromGarage ?? 0) > 0);
    }
    return true;
  });

  const nextOrder = () => kept.reduce((max, s) => Math.max(max, s.order ?? 0), 0) + 1;

  // One stop per supplier still being collected from, in name order — the same order the server
  // adds them in, so a prediction and a refetch lay them out the same way.
  const wanted = [...new Map(
    supplierGoods
      .filter((g) => (g.quantity ?? 0) - (g.quantityFromGarage ?? 0) > 0 && g.supplierId)
      .map((g) => [g.supplierId!, g]),
  ).values()].sort((a, b) => (a.supplierName ?? '').localeCompare(b.supplierName ?? '', 'cs'));

  for (const good of wanted) {
    if (kept.some((s) => stopKindName(s.kind) === 'Supplier' && s.supplierId === good.supplierId)) continue;

    kept.push(new OutgoingShipmentStopDto({
      // No id: this stop does not exist yet. Every consumer treats a missing id as "not
      // addressable" — the reorder controls hide, which is right for a stop the server has
      // not acknowledged.
      kind: OutgoingShipmentStopKind.Supplier,
      order: nextOrder(),
      label: good.supplierName,
      supplierId: good.supplierId,
      supplierAddress: good.supplierAddress,
      latitude: good.supplierAddress?.latitude,
      longitude: good.supplierAddress?.longitude,
      products: [],
      returns: [],
      customExtraItems: [],
      notes: [],
    }));
  }

  const needsCompany = hasStockPurchases || supplierGoods.some((g) => (g.quantityFromGarage ?? 0) > 0);
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
