using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What the client's ledger does to an invoice. The rule the whole file turns on: an invoice bills
/// what came off the van, and deviations feed it regardless of whether anybody has settled them.
/// </summary>
/// <remarks>
/// Seven of ten delivered means an invoice for seven, and it stays seven forever. The three that
/// follow are billed on the order that brings them — letting a settled entry restore the invoice to
/// ten would bill those pieces twice.
/// </remarks>
public sealed class ShipmentInvoiceLedgerTests
{
    private const long ClientId = 10;
    private const long OrderRowId = 10001;
    private const long ItemRowId = 1;
    private const long ProductRowId = 41;

    private static Client TheClient() => new()
    {
        Id = ClientId,
        PublicId = Guid.NewGuid(),
        Name = "U Zeleného stromu",
        Region = Region.ZittauCity
    };

    private static Product TheProduct() => new()
    {
        Id = ProductRowId,
        PublicId = Guid.NewGuid(),
        Name = "Ležák 12",
        Description = string.Empty,
        Kind = ProductKind.Keg,
        Type = ProductType.PaleLager,
        Container = ProductContainer.Keg,
        SaleUnit = ProductSaleUnit.Single,
        PackageSize = 50,
        PriceWithVat = 1200m,
        PriceWithoutVat = 991.74m,
        PriceForUnitWithVat = 24m
    };

    /// <summary>
    /// One client, one order of ten kegs, on a run that has already left.
    /// </summary>
    private static (ShipmentInvoiceSplit Split, OrderItem Item, Client Client, Product Product) Run(
        int orderedQuantity = 10,
        params ClientLedgerEntry[] ledger)
    {
        var client = TheClient();
        var product = TheProduct();

        var item = new OrderItem
        {
            Id = ItemRowId,
            PublicId = Guid.NewGuid(),
            OrderId = OrderRowId,
            ProductId = product.Id,
            Product = product,
            Quantity = orderedQuantity
        };

        var order = new Order
        {
            Id = OrderRowId,
            PublicId = Guid.NewGuid(),
            ClientId = client.Id,
            Client = client,
            OrderItems = [item]
        };

        var shipment = new OutgoingShipment
        {
            PublicId = Guid.NewGuid(),
            Name = "Vývoz",
            State = OutgoingShipmentState.InTransit
        };

        var stop = new OutgoingShipmentStop
        {
            Id = 31,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            OutgoingShipment = shipment
        };

        shipment.Stops.Add(stop);

        var split = new ShipmentInvoiceSplit
        {
            Shipment = shipment,
            PrivateLines = [],
            LedgerEntries = [.. ledger]
        };

        return (split, item, client, product);
    }

    private static ClientLedgerEntry Delivered(int planned, int actual, DateTime? resolvedAt = null, long id = 301) => new()
    {
        Id = id,
        PublicId = Guid.NewGuid(),
        ClientId = ClientId,
        OrderId = OrderRowId,
        OrderItemId = ItemRowId,
        ProductId = ProductRowId,
        ProductName = "Ležák 12",
        Target = ClientLedgerEntryTarget.ProductQuantity,
        PlannedQuantity = planned,
        ActualQuantity = actual,
        RequiresFollowUp = actual < planned,
        ResolvedAt = resolvedAt,
        CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
    };

    private static ClientLedgerEntry TakenAtTheDoor(Product product, int quantity, long id = 302) => new()
    {
        Id = id,
        PublicId = Guid.NewGuid(),
        ClientId = ClientId,
        OrderId = OrderRowId,
        ProductId = product.Id,
        Product = product,
        ProductName = product.Name,
        Target = ClientLedgerEntryTarget.ProductQuantity,
        PlannedQuantity = 0,
        ActualQuantity = quantity,
        RequiresFollowUp = false,
        CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
    };

    private static int BilledFor(ShipmentInvoiceSplit split, InvoiceLineSourceKind kind, long sourceId) =>
        split.Shipment.Invoices
            .SelectMany(i => i.Lines)
            .Concat(split.PrivateLines)
            .Where(l => l.SourceKind == kind && ShipmentInvoiceGraph.SourceItemIdOf(l) == sourceId)
            .Sum(l => l.Quantity);

    // ---------------------------------------------------------------------------------
    // Quantity deltas.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void Reconcile_ShortDelivery_TrimsTheInvoiceAndReportsIt()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        ShipmentInvoiceReconciler.Reconcile(split);

        split.LedgerEntries.Add(Delivered(planned: 10, actual: 7));
        var result = ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(7);
        result.Adjustments.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Kind = InvoiceAdjustmentKind.QuantityRemoved,
                SourceKind = InvoiceLineSourceKind.OrderItem,
                Quantity = 3
            });
    }

    [Fact]
    public void Reconcile_OverDeliveryOnAPlannedLine_BillsItAndReportsIt()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        ShipmentInvoiceReconciler.Reconcile(split);

        split.LedgerEntries.Add(Delivered(planned: 10, actual: 12));
        var result = ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(12);
        result.Adjustments.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Kind = InvoiceAdjustmentKind.QuantityAdded,
                SourceKind = InvoiceLineSourceKind.OrderItem,
                Quantity = 2
            });
    }

    /// <summary>
    /// The rule this feature is built around. Squaring the debt with the client is a different
    /// question from what came off the van, and the invoice answers only the second.
    /// </summary>
    [Fact]
    public void Reconcile_SettlingTheEntry_LeavesTheInvoiceAlone()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10, Delivered(planned: 10, actual: 7));
        ShipmentInvoiceReconciler.Reconcile(split);
        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(7);

        split.LedgerEntries.Single().ResolvedAt = new DateTime(2026, 8, 26, 9, 0, 0, DateTimeKind.Utc);
        var result = ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should()
            .Be(7, "the three that follow are billed on the order that brings them");
        result.Adjustments.Should().BeEmpty();
    }

    /// <summary>
    /// A line may carry a settled entry and a newer open one. Adding their deltas together would
    /// count the same shortfall twice.
    /// </summary>
    [Fact]
    public void Reconcile_LineWithASettledAndAnOpenEntry_CountsOnlyTheOpenOne()
    {
        var settled = Delivered(planned: 10, actual: 7, resolvedAt: new DateTime(2026, 8, 20, 9, 0, 0, DateTimeKind.Utc), id: 301);
        var open = Delivered(planned: 10, actual: 4, id: 302);
        open.CreatedAt = new DateTime(2026, 8, 24, 12, 0, 0, DateTimeKind.Utc);

        var (split, _, _, _) = Run(orderedQuantity: 10, settled, open);
        ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(4);
    }

    // ---------------------------------------------------------------------------------
    // A product taken at the door.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void Reconcile_ProductTakenAtTheDoor_IsBilledThroughItsLedgerEntry()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10);
        var entry = TakenAtTheDoor(product, quantity: 4);
        split.LedgerEntries.Add(entry);

        ShipmentInvoiceReconciler.Reconcile(split);

        var line = split.Shipment.Invoices
            .SelectMany(i => i.Lines)
            .Should().ContainSingle(l => l.SourceKind == InvoiceLineSourceKind.LedgerEntry).Subject;

        line.LedgerEntryId.Should().Be(entry.Id);
        line.Quantity.Should().Be(4);
        line.ProductName.Should().Be("Ležák 12");
        line.Kind.Should().Be(ProductKind.Keg);
        line.UnitPriceWithVat.Should().Be(1200m, "the catalog price, this client having no override");
    }

    /// <summary>
    /// Billing a client's own price rather than the catalog one has already been a defect here.
    /// </summary>
    [Fact]
    public void Reconcile_ProductTakenAtTheDoorByAClientWithItsOwnPrice_BillsThatPrice()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10);
        split.LedgerEntries.Add(TakenAtTheDoor(product, quantity: 2));
        split.PriceListsByClientId[ClientId] = new ClientPriceList(new Dictionary<long, decimal>
        {
            [ProductRowId] = 900m
        });

        ShipmentInvoiceReconciler.Reconcile(split);

        split.Shipment.Invoices
            .SelectMany(i => i.Lines)
            .Single(l => l.SourceKind == InvoiceLineSourceKind.LedgerEntry)
            .UnitPriceWithVat.Should().Be(900m);
    }

    [Fact]
    public void Reconcile_DoorSideProductAlsoOnTheOrder_KeepsTheTwoLinesApart()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10);
        split.LedgerEntries.Add(TakenAtTheDoor(product, quantity: 3));

        ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(10);
        BilledFor(split, InvoiceLineSourceKind.LedgerEntry, 302).Should().Be(3);
    }

    // ---------------------------------------------------------------------------------
    // Targets the invoice must ignore.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void Reconcile_MoneyEntry_DoesNotTouchTheInvoice()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        split.LedgerEntries.Add(new ClientLedgerEntry
        {
            Id = 401,
            PublicId = Guid.NewGuid(),
            ClientId = ClientId,
            OrderId = OrderRowId,
            Target = ClientLedgerEntryTarget.Money,
            Amount = 2400m,
            RequiresFollowUp = true,
            CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
        });

        ShipmentInvoiceReconciler.Reconcile(split);

        split.Shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should()
            .Be(10, "money carries no piece and no unit price");
    }

    [Fact]
    public void Reconcile_ReturnedEmptiesEntry_DoesNotTouchTheInvoice()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        split.LedgerEntries.Add(new ClientLedgerEntry
        {
            Id = 402,
            PublicId = Guid.NewGuid(),
            ClientId = ClientId,
            OrderId = OrderRowId,
            Target = ClientLedgerEntryTarget.ReturnQuantity,
            LineName = "Sudy 50 l",
            PlannedQuantity = 4,
            ActualQuantity = 1,
            RequiresFollowUp = true,
            CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
        });

        ShipmentInvoiceReconciler.Reconcile(split);

        split.Shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(10);
    }

    [Fact]
    public void Reconcile_AddressEntry_DoesNotTouchTheInvoice()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        split.LedgerEntries.Add(new ClientLedgerEntry
        {
            Id = 403,
            PublicId = Guid.NewGuid(),
            ClientId = ClientId,
            OrderId = OrderRowId,
            Target = ClientLedgerEntryTarget.DeliveryAddress,
            PlannedText = "Dlouhá 1",
            ActualText = "Krátká 2",
            CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
        });

        ShipmentInvoiceReconciler.Reconcile(split);

        split.Shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(10);
    }

    /// <summary>
    /// A standalone debt belongs to the client, not to a delivery, so it has no business on any
    /// invoice of this run.
    /// </summary>
    [Fact]
    public void Reconcile_EntryOfAnotherOrder_DoesNotTouchTheInvoice()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10);
        var stray = TakenAtTheDoor(product, quantity: 5);
        stray.OrderId = 99999;
        split.LedgerEntries.Add(stray);

        ShipmentInvoiceReconciler.Reconcile(split);

        split.Shipment.Invoices.SelectMany(i => i.Lines)
            .Should().NotContain(l => l.SourceKind == InvoiceLineSourceKind.LedgerEntry);
    }

    // ---------------------------------------------------------------------------------
    // Every counted piece must be a piece somebody can see.
    // ---------------------------------------------------------------------------------

    /// <summary>
    /// A line that is added to an invoice total but cannot be resolved to anything displayable
    /// makes the total disagree with the rows beneath it — the one failure nobody would think to
    /// look for.
    /// </summary>
    [Fact]
    public void MapToDto_EveryInvoiceTotal_EqualsTheSumOfItsOwnRenderedRows()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10, Delivered(planned: 10, actual: 7));
        split.LedgerEntries.Add(TakenAtTheDoor(product, quantity: 4));

        var result = ShipmentInvoiceReconciler.Reconcile(split);
        var dto = ShipmentInvoiceMapper.ToDto(split, result);

        foreach (var invoice in split.Shipment.Invoices)
        {
            var rendered = dto.Invoices.Single(i => i.Id == invoice.PublicId);
            rendered.Lines.Sum(l => l.Quantity).Should()
                .Be(invoice.Lines.Sum(l => l.Quantity), "every billed piece must be visible on a row");
        }

        dto.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(11, "7 delivered + 4 taken at the door");
    }

    [Fact]
    public void MapToDto_DoorSideLine_CarriesTheOrderingClientAndTheProduct()
    {
        var (split, _, client, product) = Run(orderedQuantity: 10);
        var entry = TakenAtTheDoor(product, quantity: 4);
        split.LedgerEntries.Add(entry);

        var result = ShipmentInvoiceReconciler.Reconcile(split);
        var dto = ShipmentInvoiceMapper.ToDto(split, result);

        var line = dto.Invoices
            .SelectMany(i => i.Lines)
            .Should().ContainSingle(l => l.SourceKind == InvoiceLineSourceKind.LedgerEntry).Subject;

        line.SourceItemId.Should().Be(entry.PublicId);
        line.ProductId.Should().Be(product.PublicId);
        line.Name.Should().Be("Ležák 12");
        line.OrderingClientId.Should().Be(client.PublicId);
        line.OrderingClientName.Should().Be(client.Name);
        line.Quantity.Should().Be(4);
    }
}
