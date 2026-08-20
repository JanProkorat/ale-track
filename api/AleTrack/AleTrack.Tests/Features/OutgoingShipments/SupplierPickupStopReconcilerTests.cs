using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Which pickup stops a run needs follows the supplier goods its orders ask for: a good
/// collected at the supplier puts that supplier on the route, a good already in the garage
/// puts the warehouse there instead.
/// </summary>
public sealed class SupplierPickupStopReconcilerTests
{
    [Fact]
    public void Apply_GoodCollectedAtTheSupplier_AddsThatSupplierAsAStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Supplier)));

        SupplierPickupStopReconciler.Apply(shipment);

        var stop = shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier).Subject;
        stop.SupplierId.Should().Be(linde.Id);
        // Label and coordinates travel with the FK, so the stop still renders if the
        // supplier is removed later.
        stop.Label.Should().Be("Linde Gas");
        stop.Latitude.Should().Be(50.77m);
        stop.Longitude.Should().Be(15.05m);
        // Appended after the order stops rather than inserted among them.
        stop.Order.Should().Be(2);
    }

    /// <summary>One visit to the plnírna, however many clients want a refill.</summary>
    [Fact]
    public void Apply_TwoOrdersWantingTheSameSupplier_AddsOneStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(
            OrderAsking((linde, SupplierGoodPickupSource.Supplier)),
            OrderAsking((linde, SupplierGoodPickupSource.Supplier)));

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Count(s => s.Kind == OutgoingShipmentStopKind.Supplier).Should().Be(1);
    }

    [Fact]
    public void Apply_TwoDifferentSuppliers_AddsOneStopEachInNameOrder()
    {
        var obaly = Supplier("Obaly Morava", 2, 49.6m, 17.2m);
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(
            OrderAsking((obaly, SupplierGoodPickupSource.Supplier), (linde, SupplierGoodPickupSource.Supplier)));

        SupplierPickupStopReconciler.Apply(shipment);

        var stops = shipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Supplier)
            .OrderBy(s => s.Order)
            .ToList();
        // Deterministic, so the same two suppliers lay out the same way on every run rather
        // than in whatever order the orders introduced them.
        stops.Select(s => s.Label).Should().Equal("Linde Gas", "Obaly Morava");
    }

    /// <summary>
    /// A good we already keep in the garage is collected on the way out, not fetched — the
    /// supplier gets no stop. Putting the warehouse on the route for it is
    /// <see cref="CompanyStopReconciler"/>'s job.
    /// </summary>
    [Fact]
    public void Apply_GoodCollectedFromTheGarage_AddsNoSupplierStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Garage)));

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Supplier);
    }

    /// <summary>
    /// The planner's ordering is the point, exactly as for the company stop: a supplier may
    /// deliberately sit mid-route, and an unrelated save must not shove it to the end.
    /// </summary>
    [Fact]
    public void Apply_SupplierStopAlreadyMidRoute_LeavesItsPositionAlone()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Supplier)));
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Supplier,
            Order = 1,
            SupplierId = linde.Id,
            Label = "Linde Gas"
        });
        foreach (var orderStop in shipment.Stops.Where(s => s.Kind == OutgoingShipmentStopKind.Order))
            orderStop.Order = 2;

        SupplierPickupStopReconciler.Apply(shipment);

        var stop = shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier).Subject;
        stop.Order.Should().Be(1);
    }

    [Fact]
    public void Apply_LastGoodForASupplierRemoved_DropsThatStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking());
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Supplier,
            Order = 2,
            SupplierId = linde.Id,
            Label = "Linde Gas"
        });

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Supplier);
    }

    /// <summary>
    /// The guard that matters most: an incomplete include reads as "no order asks for
    /// anything", which would silently strip every supplier stop off the run. Refusing to act
    /// on a half-loaded graph is what keeps a forgotten ThenInclude from deleting data.
    /// </summary>
    [Fact]
    public void Apply_SupplierGoodNavigationNotLoaded_LeavesExistingStopsAlone()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking());

        // A line whose SupplierGood was not included — what a missing ThenInclude looks like.
        var order = shipment.Stops.First(s => s.Kind == OutgoingShipmentStopKind.Order).ClientOrder!;
        order.SupplierGoodItems.Add(new OrderSupplierGoodItem { PublicId = Guid.NewGuid(), Quantity = 1 });

        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Supplier,
            Order = 2,
            SupplierId = linde.Id,
            Label = "Linde Gas"
        });

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier);
    }

    /// <summary>
    /// The other half of the pair: a garage-sourced good is why the warehouse is on the route,
    /// even on a run that buys nothing for stock.
    /// </summary>
    [Fact]
    public void CompanyReconciler_GarageSourcedGoodAndNoStockPurchases_AddsTheCompanyStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Garage)));

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company)
            .Which.Label.Should().Be("AleTrack s.r.o.");
    }

    /// <summary>
    /// Two reasons for one stop, so neither may remove it on the other's behalf: dropping the
    /// last stock purchase must not take the warehouse away while a garage good still needs it.
    /// </summary>
    [Fact]
    public void CompanyReconciler_NoStockPurchasesButAGarageGood_KeepsTheCompanyStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Garage)));
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = 5,
            Label = "AleTrack s.r.o."
        });

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company)
            .Which.Order.Should().Be(5);
    }

    [Fact]
    public void CompanyReconciler_OnlySupplierSourcedGoods_LeavesTheWarehouseOffTheRoute()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Supplier)));

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    /// <summary>
    /// The point of the split: a good whose default is "fetch it" but whose every piece has
    /// been moved to the garage on this run no longer justifies the trip.
    /// </summary>
    [Fact]
    public void Apply_EveryPieceMovedToTheGarage_DropsTheSupplierStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Supplier)));
        SupplierPickupStopReconciler.Apply(shipment);
        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier);

        // What the stepper does: all of it, out of the garage.
        var line = OnlyLine(shipment);
        line.QuantityFromGarage = line.Quantity;

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Supplier);
    }

    /// <summary>
    /// A partial split still needs the trip: some of it is being collected there.
    /// </summary>
    [Fact]
    public void Apply_SomePiecesStillFromTheSupplier_KeepsTheStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Supplier)));

        var line = OnlyLine(shipment);
        line.Quantity = 4;
        line.QuantityFromGarage = 3;

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier);
    }

    /// <summary>
    /// And the mirror image: a good we normally keep in the garage, fetched in full this once,
    /// puts the supplier back on the route.
    /// </summary>
    [Fact]
    public void Apply_GarageGoodMovedEntirelyToTheSupplier_AddsTheStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Garage)));

        OnlyLine(shipment).QuantityFromGarage = 0;

        SupplierPickupStopReconciler.Apply(shipment);

        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier)
            .Which.Label.Should().Be("Linde Gas");
    }

    /// <summary>
    /// The company half of the same rule: with the last garage piece moved out and nothing
    /// bought for stock, the warehouse has nothing left to offer this run.
    /// </summary>
    [Fact]
    public void CompanyReconciler_LastGaragePieceMovedToTheSupplier_DropsTheCompanyStop()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Garage)));
        CompanyStopReconciler.Apply(shipment, Company);
        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company);

        OnlyLine(shipment).QuantityFromGarage = 0;

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    /// <summary>
    /// Both stops at once, which is what a split line actually means: collect some at the
    /// warehouse, the rest at the supplier.
    /// </summary>
    [Fact]
    public void BothReconcilers_SplitLine_KeepBothStops()
    {
        var linde = Supplier("Linde Gas", 1, 50.77m, 15.05m);
        var shipment = ShipmentWithOrders(OrderAsking((linde, SupplierGoodPickupSource.Supplier)));

        var line = OnlyLine(shipment);
        line.Quantity = 5;
        line.QuantityFromGarage = 2;

        SupplierPickupStopReconciler.Apply(shipment);
        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier);
        shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    private static OrderSupplierGoodItem OnlyLine(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.SupplierGoodItems)
            .Single();

    private static Supplier Supplier(string name, long id, decimal lat, decimal lng) =>
        SupplierBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            id: id,
            name: name,
            officialAddress: AddressBuilder.BuildEntity(latitude: lat, longitude: lng));

    /// <summary>An order asking for one good per (supplier, source) pair given.</summary>
    private static Order OrderAsking(params (Supplier Supplier, SupplierGoodPickupSource Source)[] goods)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);

        var goodId = 100;
        foreach (var (supplier, source) in goods)
        {
            var good = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), id: goodId++, supplierId: supplier.Id);
            good.Supplier = supplier;
            good.PickupSource = source;

            order.SupplierGoodItems.Add(new OrderSupplierGoodItem
            {
                PublicId = Guid.NewGuid(),
                SupplierGood = good,
                Quantity = 1,
                // Seeded exactly as the order write paths do, because the split — not the
                // default that produced it — is what the reconcilers read.
                QuantityFromGarage = SupplierGoodSourcing.DefaultFromGarage(good, 1)
            });
        }

        return order;
    }

    private static OutgoingShipment ShipmentWithOrders(params Order[] orders)
    {
        var shipment = new OutgoingShipment
        {
            Name = "Vývoz",
            CreatedDate = DateTime.UtcNow,
            State = OutgoingShipmentState.Created
        };

        for (var i = 0; i < orders.Length; i++)
        {
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                Kind = OutgoingShipmentStopKind.Order,
                Order = i + 1,
                ClientOrder = orders[i]
            });
        }

        return shipment;
    }
}
