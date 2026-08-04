using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The diff behind the content freeze. Every case starts from a round-tripped pair — a
/// Loaded shipment and a DTO describing exactly its content — and changes one thing.
/// </summary>
public sealed class ShipmentContentGuardTests
{
    /// <summary>
    /// The exact shape ShipmentDetail.advance() sends: the whole object round-tripped with
    /// only State swapped. This must never be reported as a content change, or nothing could
    /// ever be marked delivered.
    /// </summary>
    [Fact]
    public void ChangedFrozenFields_UnchangedRequestAdvancingState_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTripped();

        dto.State = OutgoingShipmentState.InTransit;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_MutableFieldsChanged_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTripped();

        dto.Name = "Renamed run";
        dto.DeliveryDate = DateTime.UtcNow.AddDays(9);
        dto.DriverIds = [Guid.NewGuid()];

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_VehicleChanged_ReportsVehicleId()
    {
        var (shipment, dto) = RoundTripped();

        dto.VehicleId = Guid.NewGuid();

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.VehicleId));
    }

    [Fact]
    public void ChangedFrozenFields_VehicleRemoved_ReportsVehicleId()
    {
        var (shipment, dto) = RoundTripped();

        dto.VehicleId = null;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.VehicleId));
    }

    [Fact]
    public void ChangedFrozenFields_OrderRemoved_ReportsClientOrderShipments()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments.RemoveAt(0);

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.ClientOrderShipments));
    }

    [Fact]
    public void ChangedFrozenFields_OrderAdded_ReportsClientOrderShipments()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments.Add(new ClientOrderShipmentDto { ClientOrderId = Guid.NewGuid(), Order = 9 });

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.ClientOrderShipments));
    }

    [Fact]
    public void ChangedFrozenFields_StopResequenced_ReportsClientOrderShipments()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments[0].Order += 10;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.ClientOrderShipments));
    }

    [Fact]
    public void ChangedFrozenFields_StopAddressKindChanged_ReportsClientOrderShipments()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments[0].SelectedAddressKind = DeliveryAddressKind.Contact;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.ClientOrderShipments));
    }

    /// <summary>
    /// Loading progress travels inside ClientOrderShipments but is not content — the
    /// nakládka writes it while the shipment is Loaded and InTransit.
    /// </summary>
    [Fact]
    public void ChangedFrozenFields_LoadingProgressChanged_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments[0].OrderItems[0].IsLoadingConfirmed = true;
        dto.ClientOrderShipments[0].OrderItems[0].QuantityFromInventory = 3;
        dto.ClientOrderShipments[0].OrderItems[0].InventoryItemId = Guid.NewGuid();

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_CustomStopMoved_ReportsCustomStops()
    {
        var (shipment, dto) = RoundTripped();

        dto.CustomStops[0].Latitude += 1m;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.CustomStops));
    }

    [Fact]
    public void ChangedFrozenFields_CustomStopRelabelled_ReportsCustomStops()
    {
        var (shipment, dto) = RoundTripped();

        dto.CustomStops[0].Label = "Somewhere else";

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.CustomStops));
    }

    [Fact]
    public void ChangedFrozenFields_ViaPointAdded_ReportsRouteViaPoints()
    {
        var (shipment, dto) = RoundTripped();

        dto.RouteViaPoints.Add(new RoutePointDto { Latitude = 50.1m, Longitude = 14.4m });

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.RouteViaPoints));
    }

    /// <summary>
    /// Via points are compared in order: reordering them redraws the route.
    /// </summary>
    [Fact]
    public void ChangedFrozenFields_ViaPointsReordered_ReportsRouteViaPoints()
    {
        var (shipment, dto) = RoundTripped();

        dto.RouteViaPoints.Reverse();

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.RouteViaPoints));
    }

    [Fact]
    public void ChangedFrozenFields_StockPurchaseQuantityChanged_ReportsStockPurchases()
    {
        var (shipment, dto) = RoundTripped();

        dto.StockPurchases[0].Quantity += 5;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.StockPurchases));
    }

    [Fact]
    public void ChangedFrozenFields_StockPurchaseLoadingConfirmedChanged_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTripped();

        dto.StockPurchases[0].IsLoadingConfirmed = !dto.StockPurchases[0].IsLoadingConfirmed;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_StartPointChanged_ReportsStartPointKind()
    {
        var (shipment, dto) = RoundTripped();

        dto.StartPointKind = ShipmentStartPointKind.Brewery;
        dto.StartBreweryId = Guid.NewGuid();

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.StartPointKind));
    }

    [Fact]
    public void ChangedFrozenFields_EverythingFrozenChanged_ReportsEveryField()
    {
        var (shipment, dto) = RoundTripped();

        dto.VehicleId = Guid.NewGuid();
        dto.ClientOrderShipments.Clear();
        dto.CustomStops.Clear();
        dto.RouteViaPoints.Clear();
        dto.StockPurchases.Clear();

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEquivalentTo([
            nameof(UpdateOutgoingShipmentDto.VehicleId),
            nameof(UpdateOutgoingShipmentDto.ClientOrderShipments),
            nameof(UpdateOutgoingShipmentDto.CustomStops),
            nameof(UpdateOutgoingShipmentDto.RouteViaPoints),
            nameof(UpdateOutgoingShipmentDto.StockPurchases)
        ]);
    }

    // RoundTripped() is shared with CompanyStopTests — see OutgoingShipmentTestHelpers,
    // imported above via `using static`.
}
