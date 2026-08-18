using AleTrack.Common.Enums;
using AleTrack.Entities;
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
                Quantity = 1
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
