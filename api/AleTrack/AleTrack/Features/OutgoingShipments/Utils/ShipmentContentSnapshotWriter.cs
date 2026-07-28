using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Copies what a run carries onto rows the run owns.
/// </summary>
/// <remarks>
/// Runs on the transition into <see cref="OutgoingShipmentState.Loaded"/> — the same boundary at
/// which <see cref="ShipmentMutability"/> freezes content, which is what stops the snapshot and
/// the shipment it describes from ever diverging.
///
/// Neither method touches the DbContext. <c>stop_id</c> is required and cascading, so clearing a
/// stop's <see cref="OutgoingShipmentStop.Items"/> collection orphans the rows and EF deletes
/// them on save.
/// </remarks>
public static class ShipmentContentSnapshotWriter
{
    /// <summary>
    /// Replaces every order stop's snapshotted content and client attribution. Idempotent:
    /// re-loading a run rebuilds the rows rather than appending to them.
    /// </summary>
    public static void Apply(OutgoingShipment shipment)
    {
        foreach (var stop in shipment.Stops.Where(s =>
                     s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null))
        {
            var order = stop.ClientOrder!;

            stop.ClientPublicId = order.Client?.PublicId;
            stop.ClientName = order.Client?.Name;
            stop.ClientRegion = order.Client?.Region;

            stop.Items = [.. order.OrderItems.Select(item => Snapshot(stop, item))];
        }
    }

    /// <summary>
    /// Discards the snapshot. Called when a run reverts to
    /// <see cref="OutgoingShipmentState.Created"/> and its content becomes editable again — a
    /// stale snapshot is worse than none, and it is rebuilt on the next transition into
    /// <see cref="OutgoingShipmentState.Loaded"/>.
    /// </summary>
    public static void Clear(OutgoingShipment shipment)
    {
        foreach (var stop in shipment.Stops)
        {
            stop.Items = [];
            stop.ClientPublicId = null;
            stop.ClientName = null;
            stop.ClientRegion = null;
        }
    }

    /// <summary>
    /// One snapshotted line. Degrades to empty strings and zeroes rather than throwing: a run
    /// must still be loadable when a product row has gone missing under it.
    /// </summary>
    private static OutgoingShipmentStopItem Snapshot(OutgoingShipmentStop stop, OrderItem item)
    {
        var product = item.Product;

        return new OutgoingShipmentStopItem
        {
            PublicId = Guid.NewGuid(),
            Stop = stop,
            // Unsaved entities have id 0, which is not a foreign key value — leave the provenance
            // null rather than pointing at nothing.
            OrderItemId = item.Id == 0 ? null : item.Id,
            OrderItem = item,
            ProductId = product is null || product.Id == 0 ? null : product.Id,
            Product = product,
            ProductName = product?.Name ?? string.Empty,
            Kind = product?.Kind ?? ProductKind.Other,
            Type = product?.Type ?? default,
            PackageSize = product?.PackageSize,
            UnitsPerPackage = product?.UnitsPerPackage ?? 1,
            Quantity = item.Quantity,
            UnitPriceWithVat = product?.PriceWithVat ?? 0m,
            UnitPriceWithoutVat = product?.PriceWithoutVat,
            BreweryPublicId = product?.Brewery?.PublicId ?? Guid.Empty,
            BreweryName = product?.Brewery?.Name ?? string.Empty
        };
    }
}
