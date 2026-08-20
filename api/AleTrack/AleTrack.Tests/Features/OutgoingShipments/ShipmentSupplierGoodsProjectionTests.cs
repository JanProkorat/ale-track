using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The supplier goods a run has to bring, as the detail screen's own card reads them: one flat
/// list across every order, saying what, how much, from whom and from where.
/// </summary>
public sealed class ShipmentSupplierGoodsProjectionTests
{
    [Fact]
    public async Task ProcessAsync_GetDetail_FlattensSupplierGoodsAcrossOrdersWithTheirSource()
    {
        var shipmentId = Guid.NewGuid();

        var clientA = ClientBuilder.BuildEntity(name: "Hospoda A", officialAddress: AddressBuilder.BuildEntity());
        var clientB = ClientBuilder.BuildEntity(name: "Hospoda B", officialAddress: AddressBuilder.BuildEntity());

        var linde = SupplierBuilder.BuildEntity(publicId: Guid.NewGuid(), id: 1, name: "Linde Gas");
        var obaly = SupplierBuilder.BuildEntity(publicId: Guid.NewGuid(), id: 2, name: "Obaly Morava");

        var co2 = Good(linde, 10, "CO₂ láhev", "10 kg", SupplierGoodPickupSource.Supplier);
        var crate = Good(obaly, 11, "Přepravka", "20 ks", SupplierGoodPickupSource.Garage);

        var orderA = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: clientA);
        orderA.SupplierGoodItems = [Line(co2, 2, "Ráno")];

        var orderB = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: clientB);
        orderB.SupplierGoodItems = [Line(crate, 5)];

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderA },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderB }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [clientA, clientB],
            orders: [orderA, orderB],
            outgoingShipments: [shipment],
            suppliers: [linde, obaly],
            supplierGoods: [co2, crate]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipmentId }, CancellationToken.None);

        var goods = endpoint.Response.SupplierGoods;
        goods.Should().HaveCount(2);

        // Garage first, then supplier — the order they are actually gathered in.
        goods[0].Name.Should().Be("Přepravka");
        goods[0].PickupSource.Should().Be(SupplierGoodPickupSource.Garage);
        goods[0].SupplierName.Should().Be("Obaly Morava");
        goods[0].Quantity.Should().Be(5);
        goods[0].ClientName.Should().Be("Hospoda B");
        goods[0].OrderId.Should().Be(orderB.PublicId);

        goods[1].Name.Should().Be("CO₂ láhev");
        goods[1].Size.Should().Be("10 kg");
        goods[1].PickupSource.Should().Be(SupplierGoodPickupSource.Supplier);
        goods[1].SupplierName.Should().Be("Linde Gas");
        // Carried so the screen can draw a pickup stop for this supplier without re-reading the run.
        goods[1].SupplierAddress.Should().NotBeNull();
        goods[1].ClientName.Should().Be("Hospoda A");
        goods[1].Note.Should().Be("Ráno");
    }

    /// <summary>A run whose orders ask for nothing extra reports an empty list, not a null.</summary>
    [Fact]
    public async Task ProcessAsync_GetDetail_NoSupplierGoods_ReportsAnEmptyList()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipmentId }, CancellationToken.None);

        endpoint.Response.SupplierGoods.Should().BeEmpty();
    }

    /// <summary>
    /// A supplier stop carries the supplier's identity and address, so the route map can pin it
    /// and the stop list can name where it is.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_GetDetail_SupplierStop_CarriesItsSupplierAndAddress()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);

        var linde = SupplierBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            id: 1,
            name: "Linde Gas",
            officialAddress: AddressBuilder.BuildEntity(city: "Liberec", latitude: 50.77m, longitude: 15.05m));

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order },
                new OutgoingShipmentStop
                {
                    Order = 2,
                    Kind = OutgoingShipmentStopKind.Supplier,
                    Supplier = linde,
                    SupplierId = linde.Id,
                    Label = "Linde Gas",
                    Latitude = 50.77m,
                    Longitude = 15.05m
                }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment], suppliers: [linde]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipmentId }, CancellationToken.None);

        var stop = endpoint.Response.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Supplier);
        stop.SupplierId.Should().Be(linde.PublicId);
        stop.Label.Should().Be("Linde Gas");
        stop.SupplierAddress!.City.Should().Be("Liberec");
        // Its own coordinates too, so a removed supplier still pins.
        stop.Latitude.Should().Be(50.77m);
    }

    private static SupplierGood Good(Supplier supplier, long id, string name, string size, SupplierGoodPickupSource source)
    {
        var good = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), id: id, supplierId: supplier.Id, name: name, size: size);
        good.Supplier = supplier;
        good.PickupSource = source;
        return good;
    }

    private static OrderSupplierGoodItem Line(SupplierGood good, int quantity, string? note = null) =>
        new() { PublicId = Guid.NewGuid(), SupplierGood = good, Quantity = quantity, Note = note };
}
