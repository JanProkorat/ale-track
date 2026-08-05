using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Goods bought for our own warehouse have to come off somewhere, so the warehouse
/// stop follows them: it appears with the first of them and goes with the last.
/// </summary>
public sealed class CompanyStopReconcilerTests
{
    [Fact]
    public void Apply_StockPurchasesAndNoCompanyStop_AppendsOneLast()
    {
        var shipment = ShipmentWith(orderStops: 2, stockPurchases: 1);

        CompanyStopReconciler.Apply(shipment, Company);

        var companyStop = shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Company);
        companyStop.Order.Should().Be(3);
        companyStop.Label.Should().Be("AleTrack s.r.o.");
        companyStop.Latitude.Should().Be(50.841437m);
    }

    /// <summary>
    /// The planner's ordering is the point: a run may call at the warehouse
    /// mid-route and carry on abroad afterwards. An unrelated save must not
    /// shove it back to the end.
    /// </summary>
    [Fact]
    public void Apply_CompanyStopAlreadyMidRoute_LeavesItsPositionAlone()
    {
        var shipment = ShipmentWith(orderStops: 4, stockPurchases: 1);
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = 3,
            Label = "AleTrack s.r.o.",
            Latitude = 50.841437m,
            Longitude = 14.837309m
        });

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Count(s => s.Kind == OutgoingShipmentStopKind.Company).Should().Be(1);
        shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Company).Order.Should().Be(3);
    }

    [Fact]
    public void Apply_LastStockPurchaseRemoved_DropsTheCompanyStop()
    {
        var shipment = ShipmentWith(orderStops: 2, stockPurchases: 0);
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = 3,
            Label = "AleTrack s.r.o."
        });

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    [Fact]
    public void Apply_NoStockPurchasesAndNoCompanyStop_ChangesNothing()
    {
        var shipment = ShipmentWith(orderStops: 2, stockPurchases: 0);

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().HaveCount(2);
    }

    /// <summary>
    /// A run with nothing but warehouse goods on it is legal — the stop is the
    /// only one, and numbering starts at 1 rather than at 0 or at 2.
    /// </summary>
    [Fact]
    public void Apply_StockPurchasesOnEmptyRoute_NumbersTheStopOne()
    {
        var shipment = ShipmentWith(orderStops: 0, stockPurchases: 1);

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Single().Order.Should().Be(1);
    }

    private static OutgoingShipment ShipmentWith(int orderStops, int stockPurchases)
    {
        var shipment = new OutgoingShipment
        {
            Name = "Vývoz",
            CreatedDate = DateTime.UtcNow,
            State = OutgoingShipmentState.Created
        };

        for (var i = 1; i <= orderStops; i++)
        {
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                Kind = OutgoingShipmentStopKind.Order,
                Order = i
            });
        }

        for (var i = 0; i < stockPurchases; i++)
        {
            shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
            {
                PublicId = Guid.NewGuid(),
                Product = ProductBuilder.BuildEntity(),
                Quantity = 6
            });
        }

        return shipment;
    }
}
