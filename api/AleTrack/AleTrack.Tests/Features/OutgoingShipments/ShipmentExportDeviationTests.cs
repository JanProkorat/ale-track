using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// How recorded deviations reach the export model: all of them onto the client that diverged, and a
/// mark on the rows they touched.
/// </summary>
/// <remarks>
/// Both halves matter, and they are not the same half. The list is what the file states, and every
/// deviation has to be in it — a deviation written against a line the file does not bill still
/// happened. The marks are only how the Changed scope knows which rows to keep, so a deviation with
/// no row of its own leaves none.
/// </remarks>
public sealed class ShipmentExportDeviationTests
{
    private const long ShipmentInternalId = 900;

    private static Task<ShipmentExportModel?> Load(AleTrackDbContext dbContext, Guid shipmentId) =>
        ShipmentExportQuery.LoadAsync(
            dbContext, shipmentId, OutgoingShipmentTestHelpers.Company, null, CancellationToken.None);

    /// <summary>
    /// One confirmed client ordering 24 of one product, which is the smallest run that has a billed
    /// row to hang a deviation on.
    /// </summary>
    private static (OutgoingShipment Shipment, Client Client, Order Order, OrderItem Item, Product Product)
        OneClientRun(Guid shipmentId)
    {
        var product = new Product
        {
            PublicId = Guid.NewGuid(),
            Name = "Pilsner Urquell",
            Description = "Pilsner Urquell",
            Kind = ProductKind.Keg,
            Container = ProductContainer.Keg,
            SaleUnit = ProductSaleUnit.Single,
            UnitsPerPackage = 1,
            Type = ProductType.PaleLager,
            PlatoDegree = 12f,
            PackageSize = 50,
            AlcoholPercentage = 4.4f,
            PriceWithVat = 2400m,
            PriceForUnitWithVat = 2400m,
            PriceForUnitWithoutVat = 1983.47m
        };

        var item = new OrderItem { PublicId = Guid.NewGuid(), Product = product, Quantity = 24 };

        var client = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            officialAddress: AddressBuilder.BuildEntity(city: "Brno"));

        var order = OrderBuilder.BuildEntity(client: client, orderItems: [item]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        shipment.Id = ShipmentInternalId;

        long next = 1;
        client.Id = next++;
        order.ClientId = client.Id;
        order.Id = next++;
        item.Id = next++;

        foreach (var giveBack in order.Returns)
            giveBack.Id = next++;

        shipment.InvoiceConfirmations.Add(new OutgoingShipmentInvoiceConfirmation
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipmentId = shipment.Id,
            ClientId = client.Id,
            Client = client,
            Number = 1,
            IsReady = true
        });

        return (shipment, client, order, item, product);
    }

    /// <summary>A deviation as the recording drawer leaves one.</summary>
    private static ClientLedgerEntry Entry(
        Client client,
        Order order,
        ClientLedgerEntryTarget target,
        int? planned = null,
        int? actual = null,
        OrderItem? item = null,
        Product? product = null,
        OrderReturn? giveBack = null,
        string? lineName = null,
        string? note = null,
        decimal? amount = null,
        string? plannedText = null,
        string? actualText = null,
        bool requiresFollowUp = false) =>
        new()
        {
            PublicId = Guid.NewGuid(),
            ClientId = client.Id,
            OrderId = order.Id,
            Target = target,
            OrderItemId = item?.Id,
            ProductId = product?.Id,
            ProductName = product?.Name,
            Product = product,
            OrderReturnId = giveBack?.Id,
            LineName = lineName,
            PlannedQuantity = planned,
            ActualQuantity = actual,
            PlannedText = plannedText,
            ActualText = actualText,
            Amount = amount,
            Note = note,
            RequiresFollowUp = requiresFollowUp,
            CreatedAt = new DateTime(2026, 8, 20, 8, 0, 0, DateTimeKind.Utc)
        };

    private static ShipmentExportInvoiceParty PartyOf(ShipmentExportModel model) =>
        model.Invoices.SelectMany(i => i.Parties).Single();

    [Fact]
    public async Task LoadAsync_NoDeviations_LeavesEveryRowClean()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, _) = OneClientRun(shipmentId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);

        var model = await Load(dbContext.Object, shipmentId);

        var party = PartyOf(model!);
        party.HasDeviations.Should().BeFalse();
        party.Products.Should().OnlyContain(p => p.Deviation == null);
        party.Deviations.Should().BeEmpty();
    }

    /// <summary>
    /// The plain case: six of the twenty-four kegs never came off the van, so the row it happened on
    /// carries the pair — and neither of the two numbers already on that row moves.
    /// </summary>
    [Fact]
    public async Task LoadAsync_ShortDelivery_LandsOnTheRowItIsAbout()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, item, product) = OneClientRun(shipmentId);

        var entry = Entry(
            client, order, ClientLedgerEntryTarget.ProductQuantity,
            planned: 24, actual: 18, item: item, product: product,
            note: "Sklep byl plný", requiresFollowUp: true);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment], clientLedgerEntries: [entry]);

        var model = await Load(dbContext.Object, shipmentId);

        var row = PartyOf(model!).Products.Single();

        row.Quantity.Should().Be(24, "the invoice split is what bills, and it did not change");
        row.Deviation.Should().NotBeNull();
        row.Deviation!.PlannedQuantity.Should().Be(24);
        row.Deviation.ActualQuantity.Should().Be(18);
        row.Deviation.QuantityDifference.Should().Be(-6);
        row.Deviation.Note.Should().Be("Sklep byl plný");
        row.Deviation.RequiresFollowUp.Should().BeTrue();

        // And it is stated once, on the client — the mark above only says which row it was about.
        PartyOf(model!).Deviations.Should().ContainSingle()
            .Which.LineName.Should().Be("Pilsner Urquell");
    }

    /// <summary>
    /// Goods taken at the door have no order line to annotate and nothing bills them while the ledger
    /// is out of invoicing, so they appear as a deviation and touch no billed row at all.
    /// </summary>
    [Fact]
    public async Task LoadAsync_ProductTakenAtTheDoor_IsStatedWithoutTouchingTheBilledRows()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, _) = OneClientRun(shipmentId);

        var extra = new Product
        {
            Id = 77,
            PublicId = Guid.NewGuid(),
            Name = "Kozel 11",
            Description = "Kozel 11",
            Kind = ProductKind.Bottle,
            Container = ProductContainer.Bottle,
            SaleUnit = ProductSaleUnit.Single,
            UnitsPerPackage = 1,
            Type = ProductType.PaleLager,
            PackageSize = 0.5,
            PriceWithVat = 30m,
            PriceForUnitWithVat = 30m,
            PriceForUnitWithoutVat = 24.79m
        };

        var entry = Entry(
            client, order, ClientLedgerEntryTarget.ProductQuantity,
            planned: 0, actual: 12, product: extra);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment], clientLedgerEntries: [entry]);

        var model = await Load(dbContext.Object, shipmentId);

        var party = PartyOf(model!);
        var added = party.Deviations.Should().ContainSingle().Subject;

        added.LineName.Should().Be("Kozel 11");
        added.PlannedQuantity.Should().Be(0);
        added.ActualQuantity.Should().Be(12);

        // The order's own row is untouched, and the pieces do not quietly join the billed total.
        party.Products.Select(p => p.Name).Should().Equal("Pilsner Urquell");
        party.Products.Should().OnlyContain(p => p.Deviation == null);
        party.TotalQuantity.Should().Be(24);
    }

    /// <summary>
    /// A vratka's deviation goes onto the vratka, not into the loose list — the row is right there.
    /// </summary>
    [Fact]
    public async Task LoadAsync_ReturnShort_LandsOnTheVratka()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, _) = OneClientRun(shipmentId);

        var giveBack = new OrderReturn { Id = 400, PublicId = Guid.NewGuid(), Name = "Sud 50 l", Quantity = 4 };
        order.Returns.Add(giveBack);

        var entry = Entry(
            client, order, ClientLedgerEntryTarget.ReturnQuantity,
            planned: 4, actual: 1, giveBack: giveBack, lineName: "Sud 50 l", requiresFollowUp: true);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment], clientLedgerEntries: [entry]);

        var model = await Load(dbContext.Object, shipmentId);

        var party = PartyOf(model!);
        party.Returns.Single().Deviation!.QuantityDifference.Should().Be(-3);
        party.Deviations.Should().ContainSingle().Which.LineName.Should().Be("Sud 50 l");
        party.HasDeviations.Should().BeTrue();
    }

    /// <summary>
    /// A redirected delivery and money owed are about no row at all, so they sit on the client.
    /// </summary>
    [Fact]
    public async Task LoadAsync_AddressAndMoney_SitOnTheClient()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, _) = OneClientRun(shipmentId);

        var moved = Entry(
            client, order, ClientLedgerEntryTarget.DeliveryAddress,
            plannedText: "Dlouhá 14, Brno", actualText: "Sklad Modřice");
        var owed = Entry(
            client, order, ClientLedgerEntryTarget.Money,
            amount: 2400m, note: "Nezaplaceno na místě", requiresFollowUp: true);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment],
            clientLedgerEntries: [moved, owed]);

        var model = await Load(dbContext.Object, shipmentId);

        var party = PartyOf(model!);
        party.Deviations.Select(d => d.Target).Should()
            .Equal(ClientLedgerEntryTarget.DeliveryAddress, ClientLedgerEntryTarget.Money);
        party.Deviations[0].ActualText.Should().Be("Sklad Modřice");
        party.Deviations[1].Amount.Should().Be(2400m);
        party.Products.Should().OnlyContain(p => p.Deviation == null);
    }

    /// <summary>
    /// A deviation whose line is billed on no invoice marks no row — and is stated all the same.
    /// Rendering off the marks would drop exactly this one, and losing a deviation costs money.
    /// </summary>
    [Fact]
    public async Task LoadAsync_DeviationOnALineTheFileDoesNotBill_FallsThroughToTheClient()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, product) = OneClientRun(shipmentId);

        // An order item ID the run does not carry: the line was taken off the order after the
        // deviation was recorded against it.
        var orphan = new OrderItem { Id = 8_888, PublicId = Guid.NewGuid(), Product = product, Quantity = 2 };

        var entry = Entry(
            client, order, ClientLedgerEntryTarget.ProductQuantity,
            planned: 2, actual: 0, item: orphan, product: product);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment], clientLedgerEntries: [entry]);

        var model = await Load(dbContext.Object, shipmentId);

        var party = PartyOf(model!);
        party.Deviations.Should().ContainSingle()
            .Which.LineName.Should().Be("Pilsner Urquell");
        party.Products.Should().OnlyContain(p => p.Deviation == null);
    }

    /// <summary>
    /// A standalone debt belongs to the client, not to this run — the run's paperwork is not where
    /// it is settled, and printing it there would put an old balance on a new delivery note.
    /// </summary>
    [Fact]
    public async Task LoadAsync_DebtWithNoOrderBehindIt_StaysOutOfTheFile()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, _) = OneClientRun(shipmentId);

        var standalone = Entry(client, order, ClientLedgerEntryTarget.Money, amount: 800m);
        standalone.OrderId = null;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment],
            clientLedgerEntries: [standalone]);

        var model = await Load(dbContext.Object, shipmentId);

        PartyOf(model!).HasDeviations.Should().BeFalse();
    }

    /// <summary>
    /// Deviations of another run's orders are not this run's business, even for the same client.
    /// </summary>
    [Fact]
    public async Task LoadAsync_DeviationOfAnotherRun_StaysOutOfTheFile()
    {
        var shipmentId = Guid.NewGuid();
        var (shipment, client, order, _, _) = OneClientRun(shipmentId);

        var elsewhere = Entry(client, order, ClientLedgerEntryTarget.Money, amount: 500m);
        elsewhere.OrderId = 12_345;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment],
            clientLedgerEntries: [elsewhere]);

        var model = await Load(dbContext.Object, shipmentId);

        PartyOf(model!).HasDeviations.Should().BeFalse();
    }
}
