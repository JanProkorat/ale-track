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

    /// <summary>
    /// Loads with no selection — every confirmed row. Choosing a subset is covered by
    /// <see cref="ExportSelectionTests"/>.
    /// </summary>
    private static Task<ShipmentExportModel?> Load(AleTrackDbContext dbContext, Guid shipmentId) =>
        ShipmentExportQuery.LoadAsync(dbContext, shipmentId, Company, null, CancellationToken.None);

    /// <summary>
    /// The one party billing a named client's goods, wherever in the invoice part it sits — the
    /// delivery details live there now rather than on the stop.
    /// </summary>
    private static ShipmentExportInvoiceParty PartyOf(ShipmentExportModel model, string clientName) =>
        model.Invoices.SelectMany(i => i.Parties).Single(p => p.ClientName == clientName);

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
    public async Task LoadAsync_OrderAndCustomStops_ListsEveryStopAndCountsOnlyTheClientOnes()
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

        // The custom stop is part of the route and is listed, but it has no client and no goods,
        // so the overview's client count leaves it out.
        model.Stops[1].ClientName.Should().BeNull();
        model.Stops[1].Label.Should().Be("Čerpací stanice");

        model.ClientStops.Select(s => s.ClientName).Should().Equal("Hospoda U Kotvy", "Pivnice Na Růhu");

        var first = model.ClientStops.First();
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

        var orderWith = OrderBuilder.BuildEntity(
            client: withContact, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var orderWithout = OrderBuilder.BuildEntity(
            client: withoutContact, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

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
        Confirm(shipment, withContact, number: 1);
        Confirm(shipment, withoutContact, number: 2);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [withContact, withoutContact],
            orders: [orderWith, orderWithout],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        PartyOf(model!, "S kontaktní").Street.Should().Be("Provozovna 9");
        PartyOf(model!, "S kontaktní").CityLine.Should().Be("612 00 Brno");

        PartyOf(model!, "Bez kontaktní").Street.Should().Be("Sídlo 2");
        PartyOf(model!, "Bez kontaktní").CityLine.Should().Be("00000 Zlín");
    }

    [Fact]
    public async Task Build_ClientWithOnlyAContactAddress_ExportsThatAddress()
    {
        // A client billed through its payer has no official address, and an Official-kind stop
        // would otherwise export a blank street and city.
        var shipmentId = Guid.NewGuid();

        var invoicedClient = ClientBuilder.BuildEntity(
            name: "Hospoda Pod Mostem",
            noOfficialAddress: true,
            contactAddress: AddressBuilder.BuildEntity(streetName: "Provozovna", streetNumber: "9", zip: "612 00", city: "Brno"));

        var order = OrderBuilder.BuildEntity(
            client: invoicedClient, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

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
        Confirm(shipment, invoicedClient, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [invoicedClient],
            orders: [order],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var party = PartyOf(model!, "Hospoda Pod Mostem");
        party.Street.Should().Be("Provozovna 9");
        party.CityLine.Should().Be("612 00 Brno");
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

        var sentBack = ClientBuilder.BuildEntity(
            name: "Hospoda Vrácená",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Sídlo", streetNumber: "1", city: "Praha"));

        var deliveringOrder = OrderBuilder.BuildEntity(
            client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var officialOrder = OrderBuilder.BuildEntity(
            client: sentBack, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

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
        Confirm(shipment, client, number: 1);
        Confirm(shipment, sentBack, number: 2);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client, sentBack],
            orders: [deliveringOrder, officialOrder],
            outgoingShipments: [shipment],
            clientDeliveryPlaces: [place]);

        var model = await Load(dbContext.Object, shipmentId);

        var delivering = PartyOf(model!, "Hospoda");
        delivering.Street.Should().Be("Nábřeží 7");
        delivering.CityLine.Should().Be("603 00 Brno");
        delivering.DeliveryPlaceName.Should().Be("Zahrádka");

        var back = PartyOf(model!, "Hospoda Vrácená");
        back.Street.Should().Be("Sídlo 1");
        back.DeliveryPlaceName.Should().BeNull();
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
    public async Task LoadAsync_OrderWithNotesReturnsAndCustomExtras_CarriesAllThreeOntoTheParty()
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
        Confirm(shipment, client, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);
        var party = model!.Invoices.Single().Parties.Single();

        // Oldest first, as the order records them.
        party.Notes.Should().Equal("Starší", "Novější");

        // A custom extra is an ordered item too, so it is billed like one — with no kind and no
        // package, because no product stands behind it.
        party.Products.Select(p => p.Name).Should().Equal("Pilsner Urquell", "Slunečník");
        party.Products[1].Kind.Should().BeNull();
        party.Products[1].PackageSize.Should().BeNull();
        party.TotalQuantity.Should().Be(26);

        party.Returns.Select(r => r.Name).Should().Equal("Přepravka", "Sud 30l KEG");
        party.Returns.Single(r => r.Name == "Sud 30l KEG").Note.Should().Be("poškozený ventil");

        // The van's own page still counts what it drops.
        model.Stops[0].TotalQuantity.Should().Be(26);
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
        model.ClientStops.Should().HaveCount(1, "nobody ordered the stock goods, so they belong to no stop");
        model.TotalQuantity.Should().Be(7, "4 ordered plus 3 bought for our own warehouse");

        var expectedWeight =
            (ProductWeightCalculator.Compute(ProductKind.Keg, 30) ?? 0) * 4
            + (ProductWeightCalculator.Compute(ProductKind.Keg, 50) ?? 0) * 3;

        model.TotalWeight.Should().BeApproximately(expectedWeight, 0.001);
        model.TotalWeight.Should().BeGreaterThan(0, "kegs of a known size have a derivable weight");
    }

    [Fact]
    public async Task LoadAsync_NobodyHasTouchedFakturaceYet_StillBillsEveryDeliveredPiece()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(name: "Hospoda", officialAddress: AddressBuilder.BuildEntity());

        var order = OrderBuilder.BuildEntity(client: client, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);
        Confirm(shipment, client, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // The run has no stored split at all. Reading the stored lines alone would bill nothing on
        // every run nobody has opened Fakturace on — which is why the query reconciles first,
        // exactly as that screen does.
        var party = model!.Invoices.Single().Parties.Single();
        party.Products.Select(p => (p.Name, p.Quantity)).Should().Equal(("Pilsner Urquell", 24));
        model.Stops.Single().TotalQuantity.Should().Be(24, "the van still drops all of it");
    }

    [Fact]
    public async Task LoadAsync_PiecesBilledToAnotherClient_AppearOnThePayersBlockAsTheirOwnParty()
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

        Confirm(shipment, payer, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ordering, payer], orders: [orderingOrder, payerOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // One block, the payer's — the client that ordered the cross-billed pieces holds no invoice
        // of its own and so has no block, only a party inside this one.
        var block = model!.Invoices.Should().ContainSingle().Subject;
        block.PayingClientName.Should().Be("Pivnice Sever");

        block.Parties.Select(p => (p.ClientName, p.IsPayer, p.TotalQuantity)).Should().Equal(
            ("Pivnice Sever", true, 6),
            ("Hospoda U Kotvy", false, 24));

        block.TotalQuantity.Should().Be(30);

        // The van's own page is unchanged: each stop still reports what is dropped there, whoever
        // ends up being billed for it.
        model.Stops.Select(s => s.TotalQuantity).Should().Equal(24, 6);
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

        Confirm(shipment, client, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment],
            outgoingShipmentInvoiceLines: [privateLine]);

        var model = await Load(dbContext.Object, shipmentId);

        // The private pieces are exactly what makes the billed number fall short of the delivered
        // one: the stop drops 24, the invoice bills 20, and the four appear nowhere in the file.
        model!.ClientStops.Single().TotalQuantity.Should().Be(24);
        model.Invoices.Single().Parties.Single().Products
            .Select(p => (p.Name, p.Quantity)).Should().Equal(("Pilsner Urquell", 20));
    }

    [Fact]
    public async Task LoadAsync_OneClientOnTwoStops_BillsBothDropsOnOneBlockWithoutDoubling()
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
        Confirm(shipment, client, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [morning, afternoon], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // One client, one confirmed row, two drops: both orders bill on the one block, each piece
        // once. The route table still shows the two calls separately.
        var party = model!.Invoices.Should().ContainSingle().Subject.Parties.Should().ContainSingle().Subject;
        party.Products.Select(p => (p.Name, p.Quantity)).Should().Equal(("Kozel 11", 6), ("Pilsner Urquell", 24));
        party.TotalQuantity.Should().Be(30);

        model.Stops.Select(s => s.TotalQuantity).Should().Equal(24, 6);
    }

    [Fact]
    public async Task LoadAsync_WarehouseStop_CarriesOurOwnTownAndTheGoodsThatComeOffThere()
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
        warehouse.City.Should().Be("Liberec");

        // And it hands goods over, so it reports a count rather than a dash.
        warehouse.Products.Select(p => p.Name).Should().Equal("Radegast");
        warehouse.TotalQuantity.Should().Be(3);

        // It is a call on the route without being a client.
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

        // The payer is the row the office confirms — one tick for the whole group.
        Confirm(shipment, payer, number: 1);

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
        Confirm(shipment, payer, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // The van never calls on the payer, so it gets no stop of its own.
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
    public async Task Build_SubClientGoods_AreBilledOnThePayersBlockAndStillDeliveredToTheSubClient()
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

        // The payer is the row the office confirms — the sub-client has none of its own, which is
        // what makes one tick cover the whole group.
        Confirm(shipment, payer, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var block = model!.Invoices.Should().ContainSingle().Subject;
        block.PayingClientName.Should().Be("Skupina Sever");

        // Every piece is billed, just not to the client that ordered it — and the party is where the
        // office reads whose goods they were.
        var party = block.Parties.Should().ContainSingle().Subject;
        party.ClientName.Should().Be("Hospoda U Kotvy");
        party.Products.Select(p => (p.Name, p.Quantity)).Should().Equal(("Kozel 11", 6), ("Pilsner Urquell", 24));

        // The van still drops all of it at the sub-client.
        model.ClientStops.Single().TotalQuantity.Should().Be(30);
    }

    [Fact]
    public async Task Build_HandMovedLine_BillsOnTheTargetsBlockWithoutAPayerRelation()
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

        Confirm(shipment, payer, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ordering, payer], orders: [orderingOrder, payerOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // No payer relation anywhere: this is one line the office moved by hand. It bills on the
        // target's block as the ordering client's own party, and the ordering client — holding no
        // invoice of its own — gets no block.
        var block = model!.Invoices.Should().ContainSingle().Subject;
        block.PayingClientName.Should().Be("Pivnice Sever");
        block.Parties.Select(p => (p.ClientName, p.IsPayer)).Should().Equal(
            ("Pivnice Sever", true),
            ("Hospoda U Kotvy", false));

        // Its own delivery is untouched, and so is the other client's.
        model.Stops.Select(s => s.TotalQuantity).Should().Equal(24, 6);
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

        // One confirmed row, two invoices on it — both blocks share its number.
        Confirm(shipment, payer, number: 1);

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

        Confirm(shipment, payer, number: 1);

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
    public async Task Build_SubClientLineMovedOntoAThirdClient_BillsOnThatClientsBlockOnly()
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

        // Both the third client and the payer are confirmed, so nothing but the split itself
        // decides which of them the pieces appear under.
        Confirm(shipment, third, number: 1);
        Confirm(shipment, payer, number: 2);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva, third],
            orders: [kotvaOrder, thirdOrder],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        // The payer holds an invoice here, but an empty one — the line went elsewhere — so it
        // contributes no block even though its row is confirmed.
        model!.Invoices.Should().ContainSingle();
        model.Invoices.Single().PayingClientName.Should().Be("Pivnice Sever");
        model.Invoices.Should().NotContain(i => i.PayingClientName == "Skupina Sever");

        // The sub-client is still delivered to, whoever ended up being billed.
        model.ClientStops.Single(st => st.ClientName == "Hospoda U Kotvy").TotalQuantity.Should().Be(24);
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

        Confirm(shipment, payer, number: 1);

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
        Confirm(shipment, client, number: 1);

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

    #region readiness and the export's own numbering

    /// <summary>
    /// Marks a client's row as confirmed, as <c>SetInvoiceReadinessEndpoint</c> leaves it. Called
    /// after <see cref="AssignInternalIds"/>, which is what gives the client its ID.
    /// </summary>
    private static void Confirm(OutgoingShipment shipment, Client client, int number, bool isReady = true) =>
        shipment.InvoiceConfirmations.Add(new OutgoingShipmentInvoiceConfirmation
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipmentId = shipment.Id,
            ClientId = client.Id,
            Client = client,
            Number = number,
            IsReady = isReady
        });

    /// <summary>
    /// Two clients, each ordering for itself — the fixture the numbering tests share.
    /// </summary>
    private static (OutgoingShipment Shipment, Client Kout, Client Lva, Order KoutOrder, Order LvaOrder)
        TwoClientRun(Guid shipmentId)
    {
        var kout = ClientBuilder.BuildEntity(name: "Pivovar Kout", officialAddress: AddressBuilder.BuildEntity());
        var lva = ClientBuilder.BuildEntity(name: "Hospoda U Lva", officialAddress: AddressBuilder.BuildEntity());

        var koutOrder = OrderBuilder.BuildEntity(
            client: kout, orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)]);
        var lvaOrder = OrderBuilder.BuildEntity(
            client: lva, orderItems: [BuildOrderItem(BuildProduct("Kozel 11", platoDegree: 11f), 6)]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = koutOrder },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = lvaOrder }
            ]);

        AssignInternalIds(shipment);

        return (shipment, kout, lva, koutOrder, lvaOrder);
    }

    [Fact]
    public async Task LoadAsync_UnconfirmedClient_IsAbsentFromTheInvoicePart()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, kout, lva, koutOrder, lvaOrder) = TwoClientRun(shipmentId);

        Confirm(shipment, lva, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [kout, lva], orders: [koutOrder, lvaOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Invoices.Should().ContainSingle()
            .Which.PayingClientName.Should().Be("Hospoda U Lva");
    }

    /// <summary>
    /// The number is the office's own, so it leads the ordering: U Lva was confirmed first and
    /// prints as 1 even though Kout is ahead of it on the route.
    /// </summary>
    [Fact]
    public async Task LoadAsync_ConfirmedClients_CarryTheirNumberAndSortByIt()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, kout, lva, koutOrder, lvaOrder) = TwoClientRun(shipmentId);

        Confirm(shipment, lva, number: 1);
        Confirm(shipment, kout, number: 2);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [kout, lva], orders: [koutOrder, lvaOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Invoices.Select(i => (i.Number, i.PayingClientName)).Should()
            .Equal((1, "Hospoda U Lva"), (2, "Pivovar Kout"));
    }

    /// <summary>
    /// A row un-marked after being confirmed keeps its number but leaves the file — the number is
    /// held so re-marking gives it back, not so the export prints it anyway.
    /// </summary>
    [Fact]
    public async Task LoadAsync_UnmarkedRow_IsAbsentDespiteHoldingItsNumber()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, kout, lva, koutOrder, lvaOrder) = TwoClientRun(shipmentId);

        Confirm(shipment, lva, number: 1, isReady: false);
        Confirm(shipment, kout, number: 2);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [kout, lva], orders: [koutOrder, lvaOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Invoices.Select(i => (i.Number, i.PayingClientName)).Should().Equal((2, "Pivovar Kout"));
    }

    /// <summary>
    /// Nothing confirmed is not nothing to export: the route is still the driver's page, so the
    /// stops stay and only the invoice part is empty.
    /// </summary>
    [Fact]
    public async Task LoadAsync_NothingConfirmed_LeavesTheInvoicePartEmptyAndKeepsEveryStop()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, kout, lva, koutOrder, lvaOrder) = TwoClientRun(shipmentId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [kout, lva], orders: [koutOrder, lvaOrder], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        model!.Invoices.Should().BeEmpty();
        model.Stops.Should().HaveCount(2);
        model.TotalQuantity.Should().Be(30);
    }

    /// <summary>
    /// The stop sheets are gone, so what they carried — where the goods went, what the order said,
    /// what comes back — has to travel on the party that ordered them.
    /// </summary>
    [Fact]
    public async Task LoadAsync_Party_CarriesTheOrderingClientsAddressNotesAndReturns()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            name: "Hospoda U Lva",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Dlouhá", streetNumber: "14", city: "Brno", zip: "60200"));

        var order = OrderBuilder.BuildEntity(
            client: client,
            orderItems: [BuildOrderItem(BuildProduct("Pilsner Urquell"), 24)],
            returns: [new OrderReturn { PublicId = Guid.NewGuid(), Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" }],
            notes:
            [
                new OrderNote
                {
                    PublicId = Guid.NewGuid(), Text = "Dovézt dopoledne",
                    DateCreated = new DateTime(2026, 7, 18, 9, 0, 0, DateTimeKind.Utc)
                }
            ]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        AssignInternalIds(shipment);
        Confirm(shipment, client, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);
        var party = model!.Invoices.Single().Parties.Single();

        party.Street.Should().Be("Dlouhá 14");
        party.CityLine.Should().Be("60200 Brno");
        party.Notes.Should().Equal("Dovézt dopoledne");
        party.Returns.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" });
    }

    /// <summary>
    /// The reason the delivery details sit on the party rather than on the invoice: a payer with no
    /// delivery of its own has no address to print, while the sub-clients inside its invoice each
    /// have their own.
    /// </summary>
    [Fact]
    public async Task LoadAsync_PartiesOfAGroup_CarryEachSubClientsOwnDelivery()
    {
        var shipmentId = Guid.NewGuid();
        var payer = ClientBuilder.BuildEntity(name: "Skupina Sever", officialAddress: AddressBuilder.BuildEntity());
        var kotva = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Krátká", streetNumber: "2", city: "Zlín", zip: "76001"));
        var pivnice = ClientBuilder.BuildEntity(
            name: "Pivnice Sever",
            officialAddress: AddressBuilder.BuildEntity(streetName: "Nádražní", streetNumber: "5", city: "Praha", zip: "11000"));

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
        Confirm(shipment, payer, number: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [payer, kotva, pivnice],
            orders: [kotvaOrder, pivniceOrder],
            outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);
        var parties = model!.Invoices.Single().Parties;

        parties.Select(p => p.ClientName).Should().Equal("Hospoda U Kotvy", "Pivnice Sever");
        parties[0].Street.Should().Be("Krátká 2");
        parties[0].CityLine.Should().Be("76001 Zlín");
        parties[1].Street.Should().Be("Nádražní 5");
        parties[1].CityLine.Should().Be("11000 Praha");
    }

    #endregion

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
