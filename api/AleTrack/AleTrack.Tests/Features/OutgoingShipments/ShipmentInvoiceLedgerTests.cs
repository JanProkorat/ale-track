using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What the client's ledger does to an invoice: nothing. The invoice bills the plan, and the
/// deviations recorded on a run live only where the office reads them — the run's own Vykládka and
/// the client's open points.
/// </summary>
/// <remarks>
/// This is a decision, not an oversight, and these tests exist to keep it from being undone by
/// accident: an invoice that moves under the office while it is closing paperwork is worse than one
/// it has to correct itself. Billing the deviations means changing
/// <see cref="ShipmentInvoiceReconciler"/> back and loading the entries in
/// <see cref="ShipmentInvoiceGraph"/> — and the last test here is the one that would have to change
/// first, so a re-enabling cannot skip the lines an earlier build already wrote.
/// </remarks>
public sealed class ShipmentInvoiceLedgerTests
{
    private const long ClientId = 10;
    private const long OrderRowId = 10001;
    private const long ItemRowId = 1;
    private const long ProductRowId = 41;
    private const long DoorSideEntryId = 302;

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
    /// <remarks>
    /// The split still carries the entries it is handed. Nothing loads them into a real one any
    /// more, but passing them here is what makes these tests worth running: the reconciler is given
    /// every chance to bill them and must decline.
    /// </remarks>
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

    private static ClientLedgerEntry TakenAtTheDoor(Product product, int quantity, long id = DoorSideEntryId) => new()
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

    private static int BilledInTotal(ShipmentInvoiceSplit split) =>
        split.Shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity);

    private static bool HasALedgerLine(ShipmentInvoiceSplit split) =>
        split.Shipment.Invoices
            .SelectMany(i => i.Lines)
            .Concat(split.PrivateLines)
            .Any(l => l.SourceKind == InvoiceLineSourceKind.LedgerEntry);

    // ---------------------------------------------------------------------------------
    // A deviation on a planned line.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void Reconcile_ShortDelivery_BillsThePlanAnyway()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        ShipmentInvoiceReconciler.Reconcile(split);

        split.LedgerEntries.Add(Delivered(planned: 10, actual: 7));
        var result = ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(10);
        result.Adjustments.Should().BeEmpty("nothing about the invoice changed, so there is nothing to report");
    }

    [Fact]
    public void Reconcile_OverDelivery_BillsThePlanAnyway()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        ShipmentInvoiceReconciler.Reconcile(split);

        split.LedgerEntries.Add(Delivered(planned: 10, actual: 12));
        var result = ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(10);
        result.Adjustments.Should().BeEmpty();
    }

    /// <summary>
    /// Settling changes nothing either — there is nothing for it to change back.
    /// </summary>
    [Fact]
    public void Reconcile_SettlingTheEntry_LeavesTheInvoiceAlone()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10, Delivered(planned: 10, actual: 7));
        ShipmentInvoiceReconciler.Reconcile(split);

        split.LedgerEntries.Single().ResolvedAt = new DateTime(2026, 8, 26, 9, 0, 0, DateTimeKind.Utc);
        var result = ShipmentInvoiceReconciler.Reconcile(split);

        BilledFor(split, InvoiceLineSourceKind.OrderItem, ItemRowId).Should().Be(10);
        result.Adjustments.Should().BeEmpty();
    }

    // ---------------------------------------------------------------------------------
    // A deviation with no planned line behind it.
    // ---------------------------------------------------------------------------------

    /// <summary>
    /// A product the client took at the door has no order line, so billing it would mean a line
    /// sourced from the entry itself. None is opened.
    /// </summary>
    [Fact]
    public void Reconcile_ProductTakenAtTheDoor_IsNotBilled()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10);
        split.LedgerEntries.Add(TakenAtTheDoor(product, quantity: 4));

        ShipmentInvoiceReconciler.Reconcile(split);

        HasALedgerLine(split).Should().BeFalse();
        BilledInTotal(split).Should().Be(10, "the plan, and only the plan");
    }

    /// <summary>
    /// Every other target was always outside billing — money, empties, a changed address. They are
    /// asserted together because after this change they differ from a quantity deviation in nothing
    /// but their target.
    /// </summary>
    [Fact]
    public void Reconcile_MoneyEmptiesAndAddressEntries_LeaveTheInvoiceAtThePlan()
    {
        var (split, _, _, _) = Run(orderedQuantity: 10);
        split.LedgerEntries.AddRange([
            new ClientLedgerEntry
            {
                Id = 401,
                PublicId = Guid.NewGuid(),
                ClientId = ClientId,
                OrderId = OrderRowId,
                Target = ClientLedgerEntryTarget.Money,
                Amount = 2400m,
                RequiresFollowUp = true,
                CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
            },
            new ClientLedgerEntry
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
            },
            new ClientLedgerEntry
            {
                Id = 403,
                PublicId = Guid.NewGuid(),
                ClientId = ClientId,
                OrderId = OrderRowId,
                Target = ClientLedgerEntryTarget.DeliveryAddress,
                PlannedText = "Dlouhá 1",
                ActualText = "Krátká 2",
                CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
            }
        ]);

        ShipmentInvoiceReconciler.Reconcile(split);

        BilledInTotal(split).Should().Be(10);
        HasALedgerLine(split).Should().BeFalse();
    }

    // ---------------------------------------------------------------------------------
    // What an earlier build left behind.
    // ---------------------------------------------------------------------------------

    /// <summary>
    /// A build that did bill the ledger wrote lines sourced from an entry. Those must go: they hold
    /// pieces nothing accounts for any more, and a stale one would keep an invoice's total above
    /// the rows the office can see.
    /// </summary>
    [Fact]
    public void Reconcile_LedgerLineFromAnEarlierBuild_IsPrunedAndReported()
    {
        var (split, _, _, product) = Run(orderedQuantity: 10);
        ShipmentInvoiceReconciler.Reconcile(split);

        var invoice = split.Shipment.Invoices.Should().ContainSingle().Subject;
        invoice.Lines.Add(new OutgoingShipmentInvoiceLine
        {
            PublicId = Guid.NewGuid(),
            SourceKind = InvoiceLineSourceKind.LedgerEntry,
            LedgerEntryId = DoorSideEntryId,
            Quantity = 4,
            ProductName = product.Name,
            Kind = product.Kind,
            PackageSize = product.PackageSize,
            UnitPriceWithVat = product.PriceWithVat
        });

        var result = ShipmentInvoiceReconciler.Reconcile(split);

        HasALedgerLine(split).Should().BeFalse();
        BilledInTotal(split).Should().Be(10);
        result.RemovedLines.Should().ContainSingle()
            .Which.SourceKind.Should().Be(InvoiceLineSourceKind.LedgerEntry);
        result.Adjustments.Should().ContainSingle()
            .Which.Kind.Should().Be(InvoiceAdjustmentKind.SourceRemoved);
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

        dto.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(10, "the ten that were ordered");
    }
}
