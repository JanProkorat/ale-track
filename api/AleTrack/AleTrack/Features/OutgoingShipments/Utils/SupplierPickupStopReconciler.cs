using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Keeps a run's <see cref="OutgoingShipmentStopKind.Supplier"/> stops in step with the
/// supplier goods its orders ask for — one stop per supplier the run has to call at, and
/// none for goods already sitting in the garage.
/// </summary>
/// <remarks>
/// The counterpart of <see cref="CompanyStopReconciler"/>, and server-side for the same
/// reason: which stops a run needs is an invariant of the run, derived from what its orders
/// carry, and two client write paths cannot be trusted to agree on it.
///
/// One stop per <em>supplier</em>, not per order line: two clients both wanting a CO₂ refill
/// is still one visit to the plnírna. What counts is the part of each line still being
/// collected there (<c>Quantity - QuantityFromGarage</c>) — pieces moved to the garage add no
/// stop of their own, and <see cref="CompanyStopReconciler"/> is what puts the warehouse on
/// the route for those.
///
/// An existing stop keeps its position, exactly as the company stop does: a planner may have
/// deliberately put the plnírna in the middle of the route, and an unrelated save must not
/// shove it to the end.
/// </remarks>
public static class SupplierPickupStopReconciler
{
    /// <summary>
    /// Adds, keeps or removes supplier stops to match the goods the run's orders ask to be
    /// collected from a supplier.
    /// </summary>
    /// <remarks>
    /// Requires the run's stops with their <see cref="OutgoingShipmentStop.ClientOrder"/>,
    /// each order's <see cref="Order.SupplierGoodItems"/>, and each item's
    /// <see cref="OrderSupplierGoodItem.SupplierGood"/> with its
    /// <see cref="SupplierGood.Supplier"/> loaded. A caller that forgets the include reads
    /// an empty set and would quietly strip every supplier stop off the run, so the guard
    /// below refuses to act on an order whose lines were not loaded.
    /// </remarks>
    public static void Apply(OutgoingShipment shipment)
    {
        var orderStops = shipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null)
            .ToList();

        // Navigation not loaded (as opposed to genuinely empty) is indistinguishable from
        // "this order asks for nothing" once we are looking at the collection, so bail rather
        // than delete stops on the strength of an incomplete graph.
        if (orderStops.Any(s => !SupplierGoodItemsLoaded(s)))
        {
            return;
        }

        // The split, not the good's default: the default only seeded it, and moving every piece
        // of a good into the garage is exactly how a supplier stop stops being needed.
        var wanted = orderStops
            .SelectMany(s => s.ClientOrder!.SupplierGoodItems)
            .Where(i => i.SupplierGood is not null && i.Quantity - i.QuantityFromGarage > 0)
            .Select(i => i.SupplierGood.Supplier)
            .Where(supplier => supplier is not null)
            .GroupBy(supplier => supplier!.Id)
            .Select(g => g.First()!)
            .ToList();

        var wantedIds = wanted.Select(s => s.Id).ToHashSet();

        var existing = shipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Supplier)
            .ToList();

        // Gone from every order on the run — the visit is no longer needed.
        foreach (var stale in existing.Where(s => s.SupplierId is null || !wantedIds.Contains(s.SupplierId.Value)))
        {
            shipment.Stops.Remove(stale);
        }

        var keptIds = shipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Supplier && s.SupplierId is not null)
            .Select(s => s.SupplierId!.Value)
            .ToHashSet();

        // Deterministic order, so two runs asking for the same suppliers lay them out the
        // same way rather than in whatever order the orders happened to introduce them.
        foreach (var supplier in wanted.Where(s => !keptIds.Contains(s.Id)).OrderBy(s => s.Name))
        {
            var lastOrder = shipment.Stops.Count == 0 ? 0 : shipment.Stops.Max(s => s.Order);

            shipment.Stops.Add(new OutgoingShipmentStop
            {
                Kind = OutgoingShipmentStopKind.Supplier,
                Order = lastOrder + 1,
                Supplier = supplier,
                SupplierId = supplier.Id,
                // Written alongside the FK, the way the company stop stores its own label and
                // coordinates: the stop stays renderable if the supplier is removed later.
                Label = supplier.Name,
                Latitude = supplier.OfficialAddress?.Latitude,
                Longitude = supplier.OfficialAddress?.Longitude
            });
        }
    }

    /// <summary>
    /// Whether this stop's order had its supplier-good lines (and their goods) loaded.
    /// </summary>
    /// <remarks>
    /// An order with no lines at all is loaded and empty, which is fine; what this catches is
    /// a line whose <see cref="OrderSupplierGoodItem.SupplierGood"/> is null, i.e. the include
    /// chain stopped short.
    /// </remarks>
    private static bool SupplierGoodItemsLoaded(OutgoingShipmentStop stop) =>
        stop.ClientOrder!.SupplierGoodItems.All(i => i.SupplierGood is not null);
}
