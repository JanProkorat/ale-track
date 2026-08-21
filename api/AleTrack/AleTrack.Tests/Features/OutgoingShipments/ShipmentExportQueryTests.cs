using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using AleTrack.Features.Products.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Shaping of the shipment export model: which stops become sheets, which address a stop actually
/// delivers to, what lands in a client's product table, and how much of it that client is billed
/// for.
/// </summary>
/// <remarks>
/// The export answers "who receives which product, and who is billed for it", so these tests pin
/// both halves: the shipment's own stops for what is delivered, and the reconciled invoice split
/// for what is billed. Still no prices.
/// </remarks>
public sealed class ShipmentExportQueryTests
{
    /// <summary>
    /// Internal ID the stamped shipment gets — private lines are found by it.
    /// </summary>
    private const long ShipmentInternalId = 900;

    /// <summary>
    /// Internal ID a payer gets — deliberately outside the range <see cref="AssignInternalIds"/>
    /// hands out, since a payer need not own anything on the run for that walk to reach.
    /// </summary>
    private const long PayerInternalId = 500;

    /// <summary>
    /// Our own address, which is configuration rather than a row — the warehouse stop carries only
    /// a label and coordinates, so the export spells its address out from here.
    /// </summary>
    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Skladová",
        StreetNumber = "7",
        Zip = "460 01",
        City = "Liberec",
        Country = Country.Czechia,
        Latitude = 50.77m,
        Longitude = 15.06m
    };

    private static Task<ShipmentExportModel?> Load(AleTrackDbContext dbContext, Guid shipmentId) =>
        ShipmentExportQuery.LoadAsync(dbContext, shipmentId, Company, CancellationToken.None);

    /// <summary>
    /// Stamps the internal IDs a graph read out of the database would already carry.
    /// </summary>
    /// <remarks>
    /// The export reconciles the invoice split, and reconciliation refuses to match lines to
    /// sources that were never persisted — an item with <c>Id == 0</c> cannot be told apart from
    /// any other. Clients are stamped once even when they hold two orders on the run, because the
    /// split is keyed by payer and two clients sharing ID 0 would read as one.
    /// </remarks>
    private static void AssignInternalIds(OutgoingShipment shipment)
    {
        shipment.Id = ShipmentInternalId;

        long next = 1;

        foreach (var order in shipment.Stops.Where(s => s.ClientOrder is not null).Select(s => s.ClientOrder!))
        {
            if (order.Client is not null && order.Client.Id == 0)
                order.Client.Id = next++;

            order.ClientId = order.Client?.Id ?? 0;
            order.Id = next++;

            foreach (var item in order.OrderItems)
                item.Id = next++;

            foreach (var extra in order.CustomExtraItems)
                extra.Id = next++;
        }
    }
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
            // One loose container per unit, which is what this fixture has always described — it
            // never set a pack count. Stated explicitly now that weight reads the packaging pair.
            Container = kind switch
            {
                ProductKind.Keg => ProductContainer.Keg,
                ProductKind.Can => ProductContainer.Can,
                ProductKind.Bottle or ProductKind.Multipack => ProductContainer.Bottle,
                _ => ProductContainer.Other,
            },
            SaleUnit = ProductSaleUnit.Single,
            UnitsPerPackage = 1,
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

        var model = await Load(dbContext.Object, Guid.NewGuid());

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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [clientA, clientB],
            orders: [orderA, orderB],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

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

        var model = await Load(dbContext.Object, shipmentId);

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

        var model = await Load(dbContext.Object, shipmentId);

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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [withContact, withoutContact],
            orders: [orderWith, orderWithout],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Stops[0].Street.Should().Be("Provozovna 9");
        model.Stops[0].CityLine.Should().Be("612 00 Brno");

        model.Stops[1].Street.Should().Be("Sídlo 2");
        model.Stops[1].City.Should().Be("Zlín");
    }

    [Fact]
    public async Task Build_StopWhoseClientHasOnlyAContactAddress_ExportsThatAddress()
    {
        // A client billed through its payer has no official address, and an Official-kind stop
        // would otherwise export a blank street and city — on the driver's own sheet.
        var shipmentId = Guid.NewGuid();

        var invoicedClient = ClientBuilder.BuildEntity(
            name: "Hospoda Pod Mostem",
            noOfficialAddress: true,
            contactAddress: AddressBuilder.BuildEntity(streetName: "Provozovna", streetNumber: "9", zip: "612 00", city: "Brno"));

        var order = OrderBuilder.BuildEntity(client: invoicedClient);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop
                {
                    Order = 1, Kind = OutgoingShipmentStopKind.Order,
                    ClientOrder = order, SelectedAddressKind = DeliveryAddressKind.Official
                }
            ]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [invoicedClient],
            orders: [order],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Stops[0].Street.Should().Be("Provozovna 9");
        model.Stops[0].CityLine.Should().Be("612 00 Brno");
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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [deliveringOrder, officialOrder],
            outgoingShipments: [shipment],
            clientDeliveryPlaces: [place]);

        var model = await Load(dbContext.Object, shipmentId);

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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);
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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [morning, afternoon], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], products: [ordered, forStock], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.StockPurchases.Select(p => p.Name).Should().Equal("Radegast");
        model.ClientStops.Should().HaveCount(1, "nobody ordered the stock goods, so they get no sheet");
        model.TotalQuantity.Should().Be(7, "4 ordered plus 3 bought for our own warehouse");

        var expectedWeight =
            (ProductWeightCalculator.Compute(ProductKind.Keg, 30) ?? 0) * 4
            + (ProductWeightCalculator.Compute(ProductKind.Keg, 50) ?? 0) * 3;

        model.TotalWeight.Should().BeApproximately(expectedWeight, 0.001);
        model.TotalWeight.Should().BeGreaterThan(0, "kegs of a known size have a derivable weight");

        // Nobody is billed for goods bought into our own warehouse, so the question does not apply
        // — which is a different answer from "billed nothing".
        model.StockPurchases.Single().InvoicedQuantity.Should().BeNull();
    }

    [Fact]
    public async Task LoadAsync_NobodyHasTouchedFakturaceYet_BillsEveryDeliveredPieceToTheClientWhoOrderedIt()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(name: "Hospoda", officialAddress: AddressBuilder.BuildEntity());

        var order = OrderBuilder.BuildEntity(client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // The run has no stored split at all. Reading the stored lines alone would export "delivers
        // 24, bills 0" for every row on every run nobody has opened Fakturace on — which is why the
        // query reconciles first, exactly as that screen does.
        var product = model!.ClientStops.Single().Products.Single();
        product.Quantity.Should().Be(24);
        product.InvoicedQuantity.Should().Be(24);
    }

    [Fact]
    public async Task LoadAsync_PiecesBilledToAnotherClient_LeaveTheDeliveringStopAndAppearOnThePayers()
    {
        var shipmentId = Guid.NewGuid();

        var ordering = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());
        var payer = ClientBuilder.BuildEntity(name: "Pivnice Sever", officialAddress: AddressBuilder.BuildEntity());

        var orderingOrder = OrderBuilder.BuildEntity(
            client: ordering, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var payerOrder = OrderBuilder.BuildEntity(
            client: payer, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderingOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = payerOrder }
            ]);

        AssignInternalIds(shipment);

        // Fakturace as the office left it: the pieces are dropped at the first stop but billed to
        // the second client.
        var crossBilled = orderingOrder.OrderItems.Single();
        AddInvoice(shipment, payer, LineFor(crossBilled, 24), LineFor(payerOrder.OrderItems.Single(), 6));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ordering, payer], orders: [orderingOrder, payerOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var delivering = model!.Stops[0];
        var paying = model.Stops[1];

        // Delivered here, billed elsewhere — the van still drops 24.
        delivering.Products.Single().Quantity.Should().Be(24);
        delivering.Products.Single().InvoicedQuantity.Should().Be(0);
        delivering.TotalQuantity.Should().Be(24);
        delivering.TotalInvoicedQuantity.Should().Be(0);

        // The payer's own goods, plus a row for pieces they pay for and never receive.
        paying.Products.Select(p => (p.Name, p.Quantity, p.InvoicedQuantity)).Should().Equal(
            ("Kozel 11", 6, 6),
            ("Pilsner Urquell", 0, 24));

        paying.TotalQuantity.Should().Be(6, "the cross-billed row is not delivered here");
        paying.TotalInvoicedQuantity.Should().Be(30);

        // A row nobody hands over carries no weight either — the pieces are already weighed at the
        // stop that receives them.
        model.TotalQuantity.Should().Be(30);
    }

    [Fact]
    public async Task LoadAsync_PiecesKeptOffEveryInvoice_AreDeliveredWithoutBeingBilled()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(name: "Hospoda", officialAddress: AddressBuilder.BuildEntity());

        var order = OrderBuilder.BuildEntity(client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);

        var item = order.OrderItems.Single();
        AddInvoice(shipment, client, LineFor(item, 20));

        // Four pieces marked soukromé: delivered, deliberately billed to nobody.
        var privateLine = LineFor(item, 4);
        privateLine.IsPrivate = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment],
            outgoingShipmentInvoiceLines: [privateLine]);

        var model = await Load(dbContext.Object, shipmentId);

        var product = model!.ClientStops.Single().Products.Single();
        product.Quantity.Should().Be(24);
        product.InvoicedQuantity.Should().Be(20);
    }

    [Fact]
    public async Task LoadAsync_OneClientOnTwoStops_BillsEachStopForWhatItDelivers()
    {
        var shipmentId = Guid.NewGuid();

        var client = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());

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

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [morning, afternoon], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // One client, one set of invoices, two drops. Attributing the client's whole invoice to each
        // of their stops would bill the run twice; each line lands on the stop that delivers it.
        model!.Stops[0].Products.Select(p => (p.Name, p.InvoicedQuantity)).Should().Equal(("Pilsner Urquell", 24));
        model.Stops[1].Products.Select(p => (p.Name, p.InvoicedQuantity)).Should().Equal(("Kozel 11", 6));

        model.Stops.Sum(s => s.TotalInvoicedQuantity).Should().Be(30);
    }

    [Fact]
    public async Task LoadAsync_WarehouseStop_CarriesOurOwnAddressAndTheGoodsThatComeOffThere()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(name: "Hospoda", officialAddress: AddressBuilder.BuildEntity(city: "Brno"));

        var forStock = BuildProduct("Radegast", kind: ProductKind.Keg, packageSize: 50);
        var order = OrderBuilder.BuildEntity(client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 4)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order },
                // What CompanyStopReconciler adds for a run carrying goods bought for stock: a
                // label and coordinates, and no address of its own.
                new OutgoingShipmentStop
                {
                    Order = 2, Kind = OutgoingShipmentStopKind.Company,
                    Label = "AleTrack s.r.o.", Latitude = 50.77m, Longitude = 15.06m
                }
            ]);

        shipment.StockPurchases =
        [
            new OutgoingShipmentStockPurchaseItem { PublicId = Guid.NewGuid(), Product = forStock, Quantity = 3 }
        ];

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], products: [forStock], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var warehouse = model!.Stops[1];
        warehouse.IsWarehouse.Should().BeTrue();
        warehouse.Label.Should().Be("AleTrack s.r.o.");

        // Spelled out from configuration — the stop has no address row behind it, which is why the
        // overview used to list it with no town at all.
        warehouse.Street.Should().Be("Skladová 7");
        warehouse.CityLine.Should().Be("460 01 Liberec");
        warehouse.City.Should().Be("Liberec");

        // And it hands goods over, so it reports a count rather than a dash.
        warehouse.Products.Select(p => p.Name).Should().Equal("Radegast");
        warehouse.TotalQuantity.Should().Be(3);
        warehouse.Products.Single().InvoicedQuantity.Should().BeNull("nobody is billed for stock goods");

        // It gets a sheet like a client stop, without being counted as a client.
        model.SheetStops.Select(s => s.Order).Should().Equal(1, 2);
        model.ClientStops.Select(s => s.Order).Should().Equal(1);
        model.HasWarehouseStop.Should().BeTrue();

        // Counted once: the stock goods are the warehouse stop's own table now.
        model.TotalQuantity.Should().Be(7, "4 delivered plus 3 unloaded at our warehouse");
        model.TotalWeight.Should().BeApproximately(
            (ProductWeightCalculator.Compute(ProductKind.Bottle, 0.5) ?? 0) * 4
            + (ProductWeightCalculator.Compute(ProductKind.Keg, 50) ?? 0) * 3,
            0.001);
    }

    // A stop saved before the reconciler labelled them still has to name somewhere.
    [Fact]
    public async Task LoadAsync_WarehouseStopWithNoLabel_FallsBackToTheConfiguredCompanyName()
    {
        var shipmentId = Guid.NewGuid();

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Company }]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Stops.Single().Label.Should().Be("AleTrack s.r.o.");
    }

    [Fact]
    public async Task Build_SubClientGoods_ReportOneInvoiceBlockForThePayer()
    {
        var shipmentId = Guid.NewGuid();

        // The payer takes a delivery of its own but orders nothing, so the block it pays for is
        // made up entirely of its two sub-clients' goods.
        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());
        var pivnice = ClientBuilder.BuildEntity(name: "Pivnice Sever", officialAddress: AddressBuilder.BuildEntity());

        BillThrough(kotva, payer, PayerInternalId);
        BillThrough(pivnice, payer, PayerInternalId);

        var payerOrder = OrderBuilder.BuildEntity(client: payer);
        var kotvaOrder = OrderBuilder.BuildEntity(
            client: kotva, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var pivniceOrder = OrderBuilder.BuildEntity(
            client: pivnice, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = payerOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = kotvaOrder },
                new OutgoingShipmentStop { Order = 3, Kind = OutgoingShipmentStopKind.Order, ClientOrder = pivniceOrder }
            ]);

        AssignInternalIds(shipment);

        // A sub-client can legitimately still hold an invoice of its own — one opened before the
        // payer relation was set, and empty ever since. It must surface as no block at all rather
        // than as one with no lines and nobody's name on it.
        AddInvoice(shipment, kotva);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva, pivnice],
            orders: [payerOrder, kotvaOrder, pivniceOrder],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // One invoice for the run, issued to the payer — not one per sub-client, and not one for the
        // sub-client's own empty invoice either.
        model!.Invoices.Should().HaveCount(1);
        model.Invoices.Should().NotContain(i => i.PayingClientName == "Hospoda U Kotvy");

        var block = model.Invoices.Single();
        block.PayingClientName.Should().Be("Skupina Sever");
        block.PayingClientId.Should().Be(payer.PublicId);
        block.Sequence.Should().Be(1);

        // Broken down by whose goods it bills, so the office can still see who ordered what.
        block.Parties.Select(p => p.ClientName).Should().Equal("Hospoda U Kotvy", "Pivnice Sever");
        block.Parties[0].IsPayer.Should().BeFalse();
        block.Parties[1].IsPayer.Should().BeFalse();

        block.Parties[0].Products.Select(p => (p.Name, p.Quantity)).Should().Equal(("Pilsner Urquell", 24));
        block.Parties[1].Products.Select(p => (p.Name, p.Quantity)).Should().Equal(("Kozel 11", 6));

        block.Parties[0].TotalQuantity.Should().Be(24);
        block.Parties[1].TotalQuantity.Should().Be(6);
        block.TotalQuantity.Should().Be(30);
    }

    [Fact]
    public async Task Build_PayerWithNoStopOfItsOwn_StillAppearsInTheInvoicePart()
    {
        var shipmentId = Guid.NewGuid();

        // The gap this closes: a cross-billed row is only appended to a client that has a stop, so
        // a payer with no delivery of its own used to appear nowhere in the export at all.
        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());

        BillThrough(kotva, payer, PayerInternalId);

        var order = OrderBuilder.BuildEntity(
            client: kotva, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // The van never calls on the payer, so it gets no stop and no sheet.
        model!.ClientStops.Select(s => s.ClientName).Should().Equal("Hospoda U Kotvy");
        model.ClientStops.Should().NotContain(s => s.ClientName == "Skupina Sever");

        // The invoice part is the one place it does appear.
        var block = model.Invoices.Single();
        block.PayingClientName.Should().Be("Skupina Sever");
        block.Parties.Single().ClientName.Should().Be("Hospoda U Kotvy");
        block.Parties.Single().TotalQuantity.Should().Be(24);
        block.TotalQuantity.Should().Be(24);
    }

    [Fact]
    public async Task Build_SubClientStop_ReportsItsOwnPiecesAsInvoicedAndNamesThePayer()
    {
        var shipmentId = Guid.NewGuid();

        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());

        BillThrough(kotva, payer, PayerInternalId);

        var order = OrderBuilder.BuildEntity(
            client: kotva,
            orderItems:
            [
                BuildOrderItem(BuildProduct("Pilsner Urquell"), 24),
                BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)
            ]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var stop = model!.ClientStops.Single();
        stop.InvoicedToClientName.Should().Be("Skupina Sever");

        // Every piece is billed, just not to this client — reading only its own invoices would
        // print 0 down the whole Fakturačně column of a sub-client's sheet.
        stop.Products.Select(p => (p.Name, p.Quantity, p.InvoicedQuantity)).Should().Equal(
            ("Pilsner Urquell", 24, 24),
            ("Kozel 11", 6, 6));

        stop.TotalInvoicedQuantity.Should().Be(30);
    }

    [Fact]
    public async Task Build_ClientWithoutPayer_KeepsTodaysInvoicedAttribution()
    {
        var shipmentId = Guid.NewGuid();

        // Same fixture as LoadAsync_PiecesBilledToAnotherClient_...: one client's line moved onto
        // another's invoice by hand, with no payer relation anywhere.
        var ordering = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());
        var payer = ClientBuilder.BuildEntity(name: "Pivnice Sever", officialAddress: AddressBuilder.BuildEntity());

        var orderingOrder = OrderBuilder.BuildEntity(
            client: ordering, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var payerOrder = OrderBuilder.BuildEntity(
            client: payer, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderingOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = payerOrder }
            ]);

        AssignInternalIds(shipment);

        AddInvoice(
            shipment, payer,
            LineFor(orderingOrder.OrderItems.Single(), 24),
            LineFor(payerOrder.OrderItems.Single(), 6));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ordering, payer], orders: [orderingOrder, payerOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // Neither client is billed through anybody, so neither sheet claims it is.
        model!.Stops[0].InvoicedToClientName.Should().BeNull();
        model.Stops[1].InvoicedToClientName.Should().BeNull();

        // And the column reads exactly what it read before the payer feature existed: a client with
        // no payer reports the lines on its own invoices, whoever ordered them.
        model.Stops[0].Products.Select(p => (p.Name, p.Quantity, p.InvoicedQuantity)).Should().Equal(
            ("Pilsner Urquell", 24, 0));
        model.Stops[1].Products.Select(p => (p.Name, p.Quantity, p.InvoicedQuantity)).Should().Equal(
            ("Kozel 11", 6, 6),
            ("Pilsner Urquell", 0, 24));

        model.Stops[0].TotalInvoicedQuantity.Should().Be(0);
        model.Stops[1].TotalInvoicedQuantity.Should().Be(30);
    }

    [Fact]
    public async Task Build_PayerWithTwoInvoices_ReportsABlockPerInvoiceRatherThanOneMergedOne()
    {
        var shipmentId = Guid.NewGuid();

        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());
        var pivnice = ClientBuilder.BuildEntity(name: "Pivnice Sever", officialAddress: AddressBuilder.BuildEntity());

        BillThrough(kotva, payer, PayerInternalId);
        BillThrough(pivnice, payer, PayerInternalId);

        var kotvaOrder = OrderBuilder.BuildEntity(
            client: kotva, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var pivniceOrder = OrderBuilder.BuildEntity(
            client: pivnice, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = kotvaOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = pivniceOrder }
            ]);

        AssignInternalIds(shipment);

        // The office opened a second invoice for the payer and put one sub-client's goods on each —
        // a state AddShipmentInvoiceEndpoint and MoveInvoiceLineEndpoint both reach.
        AddInvoice(shipment, payer, LineFor(kotvaOrder.OrderItems.Single(), 24));
        AddInvoice(shipment, payer, LineFor(pivniceOrder.OrderItems.Single(), 6));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva, pivnice],
            orders: [kotvaOrder, pivniceOrder],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // Merging them into one block labelled #1 would discard the split the office deliberately
        // made, and the export could no longer be reconciled against the invoices actually issued.
        model!.Invoices.Should().HaveCount(2);
        model.Invoices.Select(i => (i.PayingClientName, i.Sequence, i.TotalQuantity)).Should().Equal(
            ("Skupina Sever", 1, 24),
            ("Skupina Sever", 2, 6));

        // Each block carries only the goods on its own invoice.
        model.Invoices[0].Parties.Single().ClientName.Should().Be("Hospoda U Kotvy");
        model.Invoices[0].Parties.Single().Products.Select(p => p.Name).Should().Equal("Pilsner Urquell");
        model.Invoices[1].Parties.Single().ClientName.Should().Be("Pivnice Sever");
        model.Invoices[1].Parties.Single().Products.Select(p => p.Name).Should().Equal("Kozel 11");
    }

    [Fact]
    public async Task Build_PayerThatAlsoOrders_ListsItsOwnGoodsFirst()
    {
        var shipmentId = Guid.NewGuid();

        // The payer's name deliberately sorts after the sub-client's, so only the IsPayer rule can
        // put its party first.
        var payer = ClientBuilder.BuildEntity(name: "Zamecky pivovar", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());

        BillThrough(kotva, payer, PayerInternalId);

        var payerOrder = OrderBuilder.BuildEntity(
            client: payer, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);
        var kotvaOrder = OrderBuilder.BuildEntity(
            client: kotva, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = payerOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = kotvaOrder }
            ]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva], orders: [payerOrder, kotvaOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var block = model!.Invoices.Single();
        block.PayingClientName.Should().Be("Zamecky pivovar");

        // Whoever pays reads their own goods first; the rest follow by name.
        block.Parties.Select(p => (p.ClientName, p.IsPayer)).Should().Equal(
            ("Zamecky pivovar", true),
            ("Hospoda U Kotvy", false));

        block.Parties[0].Products.Select(p => p.Name).Should().Equal("Kozel 11");
        block.Parties[1].Products.Select(p => p.Name).Should().Equal("Pilsner Urquell");
        block.TotalQuantity.Should().Be(30);
    }

    [Fact]
    public async Task Build_SubClientLineMovedOntoAThirdClient_StillNamesThePayerOnTheStop()
    {
        var shipmentId = Guid.NewGuid();

        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", officialAddress: AddressBuilder.BuildEntity());
        var third = ClientBuilder.BuildEntity(name: "Pivnice Sever", officialAddress: AddressBuilder.BuildEntity());

        BillThrough(kotva, payer, PayerInternalId);

        var kotvaOrder = OrderBuilder.BuildEntity(
            client: kotva, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var thirdOrder = OrderBuilder.BuildEntity(
            client: third, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = kotvaOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = thirdOrder }
            ]);

        AssignInternalIds(shipment);

        // The sub-client's goods were moved by hand onto a client that is neither it nor its payer.
        AddInvoice(
            shipment, third,
            LineFor(kotvaOrder.OrderItems.Single(), 24),
            LineFor(thirdOrder.OrderItems.Single(), 6));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva, third],
            orders: [kotvaOrder, thirdOrder],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var stop = model!.ClientStops.Single(s => s.ClientName == "Hospoda U Kotvy");

        // The label states the standing relation, not where these particular pieces went: this
        // client is billed through its payer, and that stays true when a line is moved off it.
        stop.InvoicedToClientName.Should().Be("Skupina Sever");

        // So a sheet can legitimately name a recipient that is billed nothing on this run.
        stop.Products.Single().Quantity.Should().Be(24);
        stop.Products.Single().InvoicedQuantity.Should().Be(0);

        // The payer does hold an invoice here, but an empty one — so it contributes no block.
        model.Invoices.Should().HaveCount(1);
        model.Invoices.Single().PayingClientName.Should().Be("Pivnice Sever");
        model.Invoices.Should().NotContain(i => i.PayingClientName == "Skupina Sever");
    }

    [Fact]
    public async Task LoadAsync_InvoiceWithBillingRecipients_ExportsTheStoredAddressNotTheClientsCurrentOne()
    {
        var shipmentId = Guid.NewGuid();

        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever");
        var kotva = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            // The client's address today — deliberately different from what was recorded on the
            // invoice, so a test that read this instead would be caught.
            officialAddress: AddressBuilder.BuildEntity(streetName: "Nová", streetNumber: "2", zip: "100 00", city: "Praha"));
        BillThrough(kotva, payer, PayerInternalId);

        var order = OrderBuilder.BuildEntity(
            client: kotva, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Delivered,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);

        AddInvoice(shipment, payer, LineFor(order.OrderItems.Single(), 24));
        shipment.Invoices.Single().BillingRecipients.Add(new OutgoingShipmentInvoiceBillingRecipient
        {
            PublicId = Guid.NewGuid(),
            ClientId = kotva.Id,
            Client = kotva,
            // The row's own copy, recorded before the client's address changed.
            Address = AddressBuilder.BuildEntity(streetName: "Stará", streetNumber: "1", zip: "602 00", city: "Brno")
        });

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva],
            orders: [order],
            outgoingShipments: [shipment],
            outgoingShipmentInvoiceBillingRecipients: shipment.Invoices.SelectMany(i => i.BillingRecipients).ToList());

        var model = await Load(dbContext.Object, shipmentId);

        var block = model!.Invoices.Single();
        var recipient = block.BillingRecipients.Should().ContainSingle().Subject;
        recipient.ClientName.Should().Be("Hospoda U Kotvy");
        recipient.Street.Should().Be("Stará 1", "the export reads the invoice's own copy, not the client's current address");
        recipient.CityLine.Should().Be("602 00 Brno");
    }

    [Fact]
    public async Task LoadAsync_InvoiceWithNoBillingRecipients_LeavesTheListEmpty()
    {
        var shipmentId = Guid.NewGuid();

        var client = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy");
        var order = OrderBuilder.BuildEntity(
            client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Invoices.Single().BillingRecipients.Should().BeEmpty();
    }

    /// <summary>
    /// Points a sub-client at its payer the way a saved row does — by ID as well as by navigation,
    /// because the split is keyed by ID.
    /// </summary>
    /// <remarks>
    /// Stamps the payer itself, which <see cref="AssignInternalIds"/> cannot: it walks the run's
    /// orders, and a payer may hold invoices without ordering anything. The ID sits well above the
    /// range that walk hands out so the two cannot collide.
    /// </remarks>
    private static void BillThrough(Client subClient, Client payer, long payerId)
    {
        payer.Id = payerId;
        subClient.InvoicingClientId = payerId;
        subClient.InvoicingClient = payer;
    }

    /// <summary>
    /// A stored invoice for a client, as the Fakturace section leaves one behind. Called twice for
    /// the same client it numbers the second one #2, the way <c>AddShipmentInvoiceEndpoint</c> does.
    /// </summary>
    private static void AddInvoice(OutgoingShipment shipment, Client client, params OutgoingShipmentInvoiceLine[] lines)
    {
        var invoice = new OutgoingShipmentInvoice
        {
            Id = shipment.Invoices.Count + 1,
            PublicId = Guid.NewGuid(),
            OutgoingShipmentId = shipment.Id,
            ClientId = client.Id,
            Client = client,
            Sequence = shipment.Invoices.Count(i => i.ClientId == client.Id) + 1,
            Lines = [.. lines]
        };

        shipment.Invoices.Add(invoice);
    }

    /// <summary>
    /// One invoice line billing an order item, with the snapshot a real line records.
    /// </summary>
    private static OutgoingShipmentInvoiceLine LineFor(OrderItem item, int quantity) =>
        new()
        {
            PublicId = Guid.NewGuid(),
            // Every line carries the shipment, invoiced or not — it is how the private ones, which
            // hang off no invoice, are found at all.
            OutgoingShipmentId = ShipmentInternalId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            OrderItemId = item.Id,
            Quantity = quantity,
            ProductName = item.Product?.Name ?? string.Empty,
            Kind = item.Product?.Kind,
            PackageSize = item.Product?.PackageSize
        };
}
