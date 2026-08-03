using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using AleTrack.Features.Products.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Shaping of the shipment export model: which stops become sheets, which address a stop actually
/// delivers to, and what lands in a client's product table.
/// </summary>
/// <remarks>
/// The export answers "who ordered which product", so these tests are also what pins it to the
/// shipment's own stops — no prices, no invoice attribution, nothing read from the invoice split.
/// </remarks>
public sealed class ShipmentExportQueryTests
{
    /// <remarks>
    /// Built directly rather than through <see cref="ProductBuilder"/>: that builder defaults a null
    /// <c>platoDegree</c> to 10, so it cannot express a beer with no degree recorded — which is
    /// exactly the case the product ordering has to get right.
    /// </remarks>
    private static Product BuildProduct(
        string name,
        ProductKind kind = ProductKind.Bottle,
        double? packageSize = 0.5,
        float? platoDegree = 10f,
        ProductType type = ProductType.PaleLager) =>
        new()
        {
            PublicId = Guid.NewGuid(),
            Name = name,
            Description = name,
            Kind = kind,
            Type = type,
            PlatoDegree = platoDegree,
            PackageSize = packageSize,
            AlcoholPercentage = 4.5f,
            PriceWithVat = 50.00m,
            PriceForUnitWithVat = 50.00m,
            PriceForUnitWithoutVat = 41.32m
        };

    private static OrderItem BuildOrderItem(Product product, int quantity) =>
        new() { PublicId = Guid.NewGuid(), Product = product, Quantity = quantity };

    [Fact]
    public async Task LoadAsync_UnknownShipment_ReturnsNull()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: []);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, Guid.NewGuid(), CancellationToken.None);

        model.Should().BeNull();
    }

    [Fact]
    public async Task LoadAsync_OrderAndCustomStops_ListsEveryStopButOnlyGivesClientStopsASheet()
    {
        var shipmentId = Guid.NewGuid();

        var clientA = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Dlouhá", streetNumber: "14", zip: "602 00", city: "Brno"));
        var clientB = ClientBuilder.BuildEntity(
            name: "Pivnice Na Růhu",
            officialAddress: AddressBuilder.BuildEntity(city: "Olomouc"));

        var orderA = OrderBuilder.BuildEntity(
            client: clientA,
            orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var orderB = OrderBuilder.BuildEntity(client: clientB);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderA },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Custom, Label = "Čerpací stanice" },
                new OutgoingShipmentStop { Order = 3, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderB }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [clientA, clientB],
            orders: [orderA, orderB],
            outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model.Should().NotBeNull();
        model!.Stops.Select(s => s.Order).Should().Equal(1, 2, 3);

        // The custom stop appears in the run's stop list — it is part of the route — but has no
        // client and no goods, so it can never carry a sheet.
        model.Stops[1].ClientName.Should().BeNull();
        model.Stops[1].Label.Should().Be("Čerpací stanice");

        model.ClientStops.Select(s => s.ClientName).Should().Equal("Hospoda U Kotvy", "Pivnice Na Růhu");

        var first = model.ClientStops.First();
        first.Street.Should().Be("Dlouhá 14");
        first.CityLine.Should().Be("602 00 Brno");
        first.City.Should().Be("Brno");
        first.TotalQuantity.Should().Be(24);
    }

    [Fact]
    public async Task LoadAsync_NameAndDeliveryDate_AreCarriedForTheOverviewSheetAndTheFileName()
    {
        var shipmentId = Guid.NewGuid();
        var deliveryDate = new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId, name: "Pátek – Brno", deliveryDate: deliveryDate);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model!.ShipmentName.Should().Be("Pátek – Brno");
        model.DeliveryDate.Should().Be(deliveryDate);
    }

    [Fact]
    public async Task LoadAsync_VehicleAndDrivers_AreNamedForTheOverviewSheet()
    {
        var shipmentId = Guid.NewGuid();

        var vehicle = VehicleBuilder.BuildEntity(name: "Iveco Daily");
        var novak = DriverBuilder.BuildEntity(firstName: "Jan", lastName: "Novák");
        var svoboda = DriverBuilder.BuildEntity(firstName: "Petr", lastName: "Adamec");

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            vehicle: vehicle,
            drivers:
            [
                new OutgoingShipmentDriver { Driver = novak },
                new OutgoingShipmentDriver { Driver = svoboda }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            drivers: [novak, svoboda],
            outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model!.VehicleName.Should().Be("Iveco Daily");
        // Surname first, so a two-driver run reads the same on every export of it.
        model.DriverNames.Should().Equal("Petr Adamec", "Jan Novák");
    }

    [Fact]
    public async Task LoadAsync_ContactAddressKind_PrefersTheContactAddressAndFallsBackToOfficial()
    {
        var shipmentId = Guid.NewGuid();

        var withContact = ClientBuilder.BuildEntity(
            name: "S kontaktní",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Sídlo", streetNumber: "1", city: "Praha"),
            contactAddress: AddressBuilder.BuildEntity(streetName: "Provozovna", streetNumber: "9", zip: "612 00", city: "Brno"));

        // Contact kind but no contact address on file — the run still has to name somewhere.
        var withoutContact = ClientBuilder.BuildEntity(
            name: "Bez kontaktní",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Sídlo", streetNumber: "2", city: "Zlín"));

        var orderWith = OrderBuilder.BuildEntity(client: withContact);
        var orderWithout = OrderBuilder.BuildEntity(client: withoutContact);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop
                {
                    Order = 1, Kind = OutgoingShipmentStopKind.Order,
                    ClientOrder = orderWith, SelectedAddressKind = DeliveryAddressKind.Contact
                },
                new OutgoingShipmentStop
                {
                    Order = 2, Kind = OutgoingShipmentStopKind.Order,
                    ClientOrder = orderWithout, SelectedAddressKind = DeliveryAddressKind.Contact
                }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [withContact, withoutContact],
            orders: [orderWith, orderWithout],
            outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model!.Stops[0].Street.Should().Be("Provozovna 9");
        model.Stops[0].CityLine.Should().Be("612 00 Brno");

        model.Stops[1].Street.Should().Be("Sídlo 2");
        model.Stops[1].City.Should().Be("Zlín");
    }

    [Fact]
    public async Task LoadAsync_DeliveryPlaceStop_UsesThePlacesAddressAndNamesItOnlyWhenItDeliversThere()
    {
        var shipmentId = Guid.NewGuid();

        var client = ClientBuilder.BuildEntity(
            name: "Hospoda",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Sídlo", streetNumber: "1", city: "Praha"));

        var place = new ClientDeliveryPlace
        {
            PublicId = Guid.NewGuid(),
            Name = "Zahrádka",
            Address = AddressBuilder.BuildEntity(streetName: "Nábřeží", streetNumber: "7", zip: "603 00", city: "Brno")
        };

        var deliveringOrder = OrderBuilder.BuildEntity(client: client);
        var officialOrder = OrderBuilder.BuildEntity(client: client);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop
                {
                    Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = deliveringOrder,
                    SelectedAddressKind = DeliveryAddressKind.DeliveryPlace, ClientDeliveryPlace = place
                },
                // Was pointed at the place once and has since been sent back to the client's own
                // address. It still carries the place, and naming it would claim a destination the
                // van is not going to.
                new OutgoingShipmentStop
                {
                    Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = officialOrder,
                    SelectedAddressKind = DeliveryAddressKind.Official, ClientDeliveryPlace = place
                }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [deliveringOrder, officialOrder],
            outgoingShipments: [shipment],
            clientDeliveryPlaces: [place]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model!.Stops[0].Street.Should().Be("Nábřeží 7");
        model.Stops[0].CityLine.Should().Be("603 00 Brno");
        model.Stops[0].DeliveryPlaceName.Should().Be("Zahrádka");

        model.Stops[1].Street.Should().Be("Sídlo 1");
        model.Stops[1].DeliveryPlaceName.Should().BeNull();
    }

    [Fact]
    public async Task LoadAsync_Products_ReadByDegreeThenPackageThenName_WithSoftDrinksLast()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        // Deliberately added out of order, so a projection that forgot to sort would hand them back
        // as inserted.
        var order = OrderBuilder.BuildEntity(
            client: client,
            orderItems:
            [
                BuildOrderItem(BuildProduct("Kofola", type: ProductType.Lemonade, platoDegree: null), 6),
                BuildOrderItem(BuildProduct("Ležák 12", platoDegree: 12f), 10),
                BuildOrderItem(BuildProduct("Nealko", platoDegree: null), 4),
                BuildOrderItem(BuildProduct("Výčepní 10", platoDegree: 10f), 20)
            ]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model!.Stops[0].Products.Select(p => p.Name).Should().Equal(
            "Výčepní 10",
            "Ležák 12",
            // A beer with no degree recorded is still beer, and sorts after the degreed ones.
            "Nealko",
            // Soft drinks last, per ProductOrdering.
            "Kofola");
    }

    [Fact]
    public async Task LoadAsync_OrderWithNotesReturnsAndCustomExtras_CarriesAllThreeOntoTheStop()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        var order = OrderBuilder.BuildEntity(
            client: client,
            orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)],
            returns:
            [
                new OrderReturn { PublicId = Guid.NewGuid(), Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" },
                new OrderReturn { PublicId = Guid.NewGuid(), Name = "Přepravka", Quantity = 12 }
            ],
            notes:
            [
                new OrderNote
                {
                    PublicId = Guid.NewGuid(), Text = "Novější",
                    DateCreated = new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc)
                },
                new OrderNote
                {
                    PublicId = Guid.NewGuid(), Text = "Starší",
                    DateCreated = new DateTime(2026, 7, 18, 9, 0, 0, DateTimeKind.Utc)
                }
            ]);

        order.CustomExtraItems =
        [
            new OrderCustomExtraItem { PublicId = Guid.NewGuid(), Description = "Slunečník", Quantity = 2 }
        ];

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);
        var stop = model!.Stops[0];

        stop.Notes.Should().Equal("Starší", "Novější");

        // A custom extra is an ordered item too, so it joins the product table — last, and with no
        // kind or package, because no product stands behind it.
        stop.Products.Select(p => p.Name).Should().Equal("Pilsner Urquell", "Slunečník");
        stop.Products[1].Kind.Should().BeNull();
        stop.Products[1].PackageSize.Should().BeNull();
        stop.TotalQuantity.Should().Be(26);

        stop.Returns.Select(r => r.Name).Should().Equal("Přepravka", "Sud 30l KEG");
        stop.Returns.Single(r => r.Name == "Sud 30l KEG").Note.Should().Be("poškozený ventil");
    }

    [Fact]
    public async Task LoadAsync_OneClientOnTwoStops_YieldsASheetPerStopRatherThanOneMergedOne()
    {
        var shipmentId = Guid.NewGuid();

        var client = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            officialAddress: AddressBuilder.BuildEntity(city: "Brno"));

        var morning = OrderBuilder.BuildEntity(
            client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var afternoon = OrderBuilder.BuildEntity(
            client: client, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = morning },
                new OutgoingShipmentStop { Order = 4, Kind = OutgoingShipmentStopKind.Order, ClientOrder = afternoon }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [morning, afternoon], outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        // Two drops at two moments — merging them would hide that there are two deliveries.
        model!.ClientStops.Should().HaveCount(2);
        model.ClientStops.Select(s => s.Order).Should().Equal(1, 4);
    }

    [Fact]
    public async Task LoadAsync_StockPurchases_CountTowardTheRunTotalWithoutBelongingToAnyStop()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        var ordered = BuildProduct("Pilsner Urquell", kind: ProductKind.Keg, packageSize: 30);
        var forStock = BuildProduct("Radegast", kind: ProductKind.Keg, packageSize: 50);

        var order = OrderBuilder.BuildEntity(client: client, orderItems: [BuildOrderItem(ordered, 4)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        shipment.StockPurchases =
        [
            new OutgoingShipmentStockPurchaseItem { PublicId = Guid.NewGuid(), Product = forStock, Quantity = 3 }
        ];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], products: [ordered, forStock], outgoingShipments: [shipment]);

        var model = await ShipmentExportQuery.LoadAsync(dbContext.Object, shipmentId, CancellationToken.None);

        model!.StockPurchases.Select(p => p.Name).Should().Equal("Radegast");
        model.ClientStops.Should().HaveCount(1, "nobody ordered the stock goods, so they get no sheet");
        model.TotalQuantity.Should().Be(7, "4 ordered plus 3 bought for our own warehouse");

        var expectedWeight =
            (ProductWeightCalculator.Compute(ProductKind.Keg, 30) ?? 0) * 4
            + (ProductWeightCalculator.Compute(ProductKind.Keg, 50) ?? 0) * 3;

        model.TotalWeight.Should().BeApproximately(expectedWeight, 0.001);
        model.TotalWeight.Should().BeGreaterThan(0, "kegs of a known size have a derivable weight");
    }
}
