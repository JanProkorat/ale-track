using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Compares an update request against the stored shipment and reports which frozen fields
/// it would actually change.
/// </summary>
/// <remarks>
/// Comparing rather than blanket-rejecting is what keeps the existing full-object PUT
/// working: <c>ShipmentDetail.advance()</c> re-sends the whole shipment with only
/// <c>State</c> swapped, so every frozen field matches and the request passes. A blanket
/// "reject any update to a non-Created shipment" would make delivery impossible.
///
/// Must be called before the endpoint touches the entity. <c>GetOrderStopsAsync</c> mutates
/// existing stops in place, which would make the stored side of this comparison reflect the
/// request instead of the database.
/// </remarks>
public static class ShipmentContentGuard
{
    /// <summary>
    /// Names of the frozen DTO fields whose value differs from the stored shipment — vehicle,
    /// stops, custom stops, via points, stock purchases and the run's start point. Empty means
    /// the request changes no frozen content.
    /// </summary>
    public static List<string> ChangedFrozenFields(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var changed = new List<string>();

        if (stored.Vehicle?.PublicId != incoming.VehicleId)
            changed.Add(nameof(incoming.VehicleId));

        if (!OrderStopsMatch(stored, incoming))
            changed.Add(nameof(incoming.ClientOrderShipments));

        if (!CustomStopsMatch(stored, incoming))
            changed.Add(nameof(incoming.CustomStops));

        if (!ViaPointsMatch(stored, incoming))
            changed.Add(nameof(incoming.RouteViaPoints));

        if (!StockPurchasesMatch(stored, incoming))
            changed.Add(nameof(incoming.StockPurchases));

        if (stored.StartPointKind != incoming.StartPointKind
            || stored.StartBrewery?.PublicId != incoming.StartBreweryId)
        {
            changed.Add(nameof(incoming.StartPointKind));
        }

        return changed;
    }

    /// <summary>
    /// Whether the request would change the preparation checklist — which steps exist, their text
    /// and their order.
    /// </summary>
    /// <remarks>
    /// Not part of <see cref="ChangedFrozenFields"/>: the checklist is worked through while the run
    /// is Loaded and InTransit, so it freezes only once the shipment becomes a historical record.
    /// The caller pairs this with that later rule.
    ///
    /// <c>IsDone</c> is not compared because the DTO does not carry it — ticks travel through the
    /// dedicated set-step endpoint.
    /// </remarks>
    public static bool PreparationStepsChanged(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedSteps = stored.PreparationSteps
            .Select(s => (Id: (Guid?)s.PublicId, s.Order, Label: (string?)s.Label))
            .OrderBy(s => s.Id)
            .ToList();

        var incomingSteps = incoming.PreparationSteps
            .Select(s => (s.Id, s.Order, Label: (string?)s.Label))
            .OrderBy(s => s.Id)
            .ToList();

        return !storedSteps.SequenceEqual(incomingSteps);
    }

    /// <summary>
    /// Composition only: which orders are on the run, in what sequence, delivering to which
    /// address.
    /// </summary>
    /// <remarks>
    /// Loading confirmation and inventory sourcing ride along inside the same DTO field but
    /// are progress rather than content — the nakládka writes them while the shipment is
    /// Loaded and InTransit — so they are deliberately not compared here.
    /// </remarks>
    private static bool OrderStopsMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedStops = stored.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null)
            .Select(s => (
                OrderId: s.ClientOrder!.PublicId,
                s.Order,
                s.SelectedAddressKind,
                PlaceId: s.ClientDeliveryPlace?.PublicId))
            .OrderBy(s => s.OrderId)
            .ToList();

        var incomingStops = incoming.ClientOrderShipments
            .Select(s => (
                OrderId: s.ClientOrderId,
                s.Order,
                s.SelectedAddressKind,
                PlaceId: s.ClientDeliveryPlaceId))
            .OrderBy(s => s.OrderId)
            .ToList();

        return storedStops.SequenceEqual(incomingStops);
    }

    private static bool CustomStopsMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedStops = stored.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Custom)
            .Select(s => (
                Id: (Guid?)s.PublicId,
                s.Order,
                s.Label,
                s.Note,
                s.Latitude,
                s.Longitude))
            .OrderBy(s => s.Id)
            .ToList();

        var incomingStops = incoming.CustomStops
            .Select(s => (
                s.Id,
                s.Order,
                Label: (string?)s.Label,
                s.Note,
                Latitude: (decimal?)s.Latitude,
                Longitude: (decimal?)s.Longitude))
            .OrderBy(s => s.Id)
            .ToList();

        return storedStops.SequenceEqual(incomingStops);
    }

    /// <summary>
    /// Ordered: via points shape the drawn route, so their sequence is part of the content.
    /// </summary>
    private static bool ViaPointsMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedPoints = stored.RouteViaPoints
            .OrderBy(p => p.Order)
            .Select(p => (p.Latitude, p.Longitude))
            .ToList();

        var incomingPoints = incoming.RouteViaPoints
            .Select(p => (p.Latitude, p.Longitude))
            .ToList();

        return storedPoints.SequenceEqual(incomingPoints);
    }

    /// <summary>
    /// Product and quantity only — <c>IsLoadingConfirmed</c> is progress, not content.
    /// </summary>
    private static bool StockPurchasesMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedPurchases = stored.StockPurchases
            .Select(p => (ProductId: p.Product.PublicId, p.Quantity))
            .OrderBy(p => p.ProductId)
            .ThenBy(p => p.Quantity)
            .ToList();

        var incomingPurchases = incoming.StockPurchases
            .Select(p => (p.ProductId, p.Quantity))
            .OrderBy(p => p.ProductId)
            .ThenBy(p => p.Quantity)
            .ToList();

        return storedPurchases.SequenceEqual(incomingPurchases);
    }
}
