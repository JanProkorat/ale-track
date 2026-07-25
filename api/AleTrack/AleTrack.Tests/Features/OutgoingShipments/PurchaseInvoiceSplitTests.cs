using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The purchase split stores only exceptions — invoice 1 is the computed remainder — so the whole
/// invariant is "no stored line claims more of a product than the run buys of it". These tests
/// pin that, plus the totals it is measured against.
/// </summary>
public sealed class PurchaseInvoiceSplitTests
{
    private const long Lezak = 101;
    private const long Ipa = 102;

    #region purchased totals

    [Fact]
    public void PurchasedByProduct_SumsOrderedPiecesAcrossClients()
    {
        var shipment = Shipment(
            OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 0)),
            OrderStop(clientId: 2, order: 2, (Lezak, qty: 6, fromInventory: 0), (Ipa, qty: 4, fromInventory: 0)));

        var totals = PurchaseInvoiceSplit.PurchasedByProduct(shipment);

        totals[Lezak].Should().Be(16);
        totals[Ipa].Should().Be(4);
    }

    [Fact]
    public void PurchasedByProduct_ExcludesPiecesTakenFromOurOwnStock()
    {
        // Those were bought on an earlier run and invoiced then; billing them again double-counts.
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 4)));

        PurchaseInvoiceSplit.PurchasedByProduct(shipment)[Lezak].Should().Be(6);
    }

    [Fact]
    public void PurchasedByProduct_OmitsAProductSourcedEntirelyFromStock()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 10)));

        PurchaseInvoiceSplit.PurchasedByProduct(shipment).Should().NotContainKey(Lezak,
            "nothing of it is bought on this run, so it cannot sit on a brewery invoice");
    }

    [Fact]
    public void PurchasedByProduct_CountsStockPurchases()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 0)));
        AddStockPurchase(shipment, Lezak, quantity: 5);

        PurchaseInvoiceSplit.PurchasedByProduct(shipment)[Lezak].Should().Be(15, "Zboží na sklad is bought here too");
    }

    #endregion

    #region caps

    [Fact]
    public void CapFor_IsTheWholePurchasedTotalWhenNoOtherInvoiceClaimsAnything()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 12, fromInventory: 0)));
        var second = AddInvoices(shipment, count: 2)[1];

        PurchaseInvoiceSplit.CapFor(shipment, second, Lezak).Should().Be(12);
    }

    [Fact]
    public void CapFor_LeavesOutTheInvoiceItIsAskedAbout()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 12, fromInventory: 0)));
        var invoices = AddInvoices(shipment, count: 3);
        AddLine(invoices[1], Lezak, quantity: 5);
        AddLine(invoices[2], Lezak, quantity: 2);

        PurchaseInvoiceSplit.CapFor(shipment, invoices[1], Lezak).Should().Be(10, "12 bought, 2 claimed by the third");
        PurchaseInvoiceSplit.CapFor(shipment, invoices[2], Lezak).Should().Be(7, "12 bought, 5 claimed by the second");
    }

    [Fact]
    public void CapFor_NeverGoesNegative()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 3, fromInventory: 0)));
        var invoices = AddInvoices(shipment, count: 3);
        AddLine(invoices[1], Lezak, quantity: 3);

        PurchaseInvoiceSplit.CapFor(shipment, invoices[2], Lezak).Should().Be(0);
    }

    #endregion

    #region clamping

    [Fact]
    public void Clamp_LeavesAValidSplitAlone()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 0)));
        var second = AddInvoices(shipment, count: 2)[1];
        AddLine(second, Lezak, quantity: 4);

        var removed = PurchaseInvoiceSplit.Clamp(shipment);

        removed.Should().BeEmpty();
        second.Lines.Single().Quantity.Should().Be(4);
        RemainderOf(shipment, Lezak).Should().Be(6);
    }

    [Fact]
    public void Clamp_QuantityCutBelowTheSplit_TrimsTheStoredLine()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 0)));
        var second = AddInvoices(shipment, count: 2)[1];
        AddLine(second, Lezak, quantity: 8);

        OrderItemOf(shipment, Lezak).Quantity = 5;
        PurchaseInvoiceSplit.Clamp(shipment);

        second.Lines.Single().Quantity.Should().Be(5);
        RemainderOf(shipment, Lezak).Should().Be(0);
    }

    [Fact]
    public void Clamp_PiecesResourcedFromOurStock_TrimTheSplitToo()
    {
        // Sourcing pieces from stock shrinks what the brewery sells us, and the stepper that does
        // it knows nothing about purchase invoices — this is exactly why clamping is not optional.
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 0)));
        var second = AddInvoices(shipment, count: 2)[1];
        AddLine(second, Lezak, quantity: 9);

        OrderItemOf(shipment, Lezak).QuantityFromInventory = 6;
        PurchaseInvoiceSplit.Clamp(shipment);

        second.Lines.Single().Quantity.Should().Be(4);
    }

    [Fact]
    public void Clamp_ProductNoLongerBought_DropsItsLine()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 10, fromInventory: 0)));
        var second = AddInvoices(shipment, count: 2)[1];
        var line = AddLine(second, Lezak, quantity: 4);

        OrderItemOf(shipment, Lezak).QuantityFromInventory = 10;
        var removed = PurchaseInvoiceSplit.Clamp(shipment);

        second.Lines.Should().BeEmpty();
        removed.Should().ContainSingle().Which.Should().Be(line, "the caller has to delete it — nothing cascades it away");
    }

    [Fact]
    public void Clamp_TrimsTheLaterInvoiceFirst()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 12, fromInventory: 0)));
        var invoices = AddInvoices(shipment, count: 3);
        AddLine(invoices[1], Lezak, quantity: 7);
        AddLine(invoices[2], Lezak, quantity: 5);

        OrderItemOf(shipment, Lezak).Quantity = 8;
        PurchaseInvoiceSplit.Clamp(shipment);

        invoices[1].Lines.Single().Quantity.Should().Be(7, "the earlier invoice keeps its claim");
        invoices[2].Lines.Single().Quantity.Should().Be(1);
        RemainderOf(shipment, Lezak).Should().Be(0);
    }

    [Fact]
    public void Clamp_NeverLetsTheRemainderGoNegative()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 6, fromInventory: 0)));
        var invoices = AddInvoices(shipment, count: 3);
        AddLine(invoices[1], Lezak, quantity: 5);
        AddLine(invoices[2], Lezak, quantity: 5);

        PurchaseInvoiceSplit.Clamp(shipment);

        RemainderOf(shipment, Lezak).Should().Be(0);
        invoices.Skip(1).SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(6);
    }

    #endregion

    #region sequencing and editability

    [Fact]
    public void NextSequence_StartsAtOneAndCounts()
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 1, fromInventory: 0)));

        PurchaseInvoiceSplit.NextSequence(shipment).Should().Be(1);
        AddInvoices(shipment, count: 2);
        PurchaseInvoiceSplit.NextSequence(shipment).Should().Be(3);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, true)]
    [InlineData(OutgoingShipmentState.InTransit, true)]
    [InlineData(OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.Cancelled, false)]
    public void IsEditable_MirrorsTheNakladkaRule(OutgoingShipmentState state, bool expected)
    {
        var shipment = Shipment(OrderStop(clientId: 1, order: 1, (Lezak, qty: 1, fromInventory: 0)));
        shipment.State = state;

        PurchaseInvoiceSplit.IsEditable(shipment).Should().Be(expected);
    }

    #endregion

    #region helpers

    /// <summary>What invoice 1 holds: everything the stored lines do not claim.</summary>
    private static int RemainderOf(OutgoingShipment shipment, long productId) =>
        PurchaseInvoiceSplit.PurchasedByProduct(shipment).GetValueOrDefault(productId)
        - PurchaseInvoiceSplit.LineHolders(shipment).SelectMany(i => i.Lines).Where(l => l.ProductId == productId).Sum(l => l.Quantity);

    private static OutgoingShipment Shipment(params OutgoingShipmentStop[] stops)
    {
        var shipment = new OutgoingShipment
        {
            PublicId = Guid.NewGuid(),
            Name = "Test",
            State = OutgoingShipmentState.Created
        };

        foreach (var stop in stops)
        {
            stop.OutgoingShipment = shipment;
            shipment.Stops.Add(stop);
        }

        return shipment;
    }

    private static OutgoingShipmentStop OrderStop(long clientId, int order, params (long productId, int qty, int fromInventory)[] items)
    {
        var clientOrder = new Order
        {
            Id = clientId * 1000 + order,
            PublicId = Guid.NewGuid(),
            ClientId = clientId
        };

        var itemId = clientOrder.Id * 10;
        foreach (var (productId, qty, fromInventory) in items)
        {
            clientOrder.OrderItems.Add(new OrderItem
            {
                Id = ++itemId,
                PublicId = Guid.NewGuid(),
                OrderId = clientOrder.Id,
                ProductId = productId,
                Quantity = qty,
                QuantityFromInventory = fromInventory
            });
        }

        return new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = order,
            ClientOrder = clientOrder
        };
    }

    private static void AddStockPurchase(OutgoingShipment shipment, long productId, int quantity) =>
        shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            Id = shipment.StockPurchases.Count + 1,
            PublicId = Guid.NewGuid(),
            ProductId = productId,
            Quantity = quantity
        });

    /// <summary>Invoices 1..N, where 1 is the remainder and the rest can hold lines.</summary>
    private static List<OutgoingShipmentPurchaseInvoice> AddInvoices(OutgoingShipment shipment, int count)
    {
        for (var i = 0; i < count; i++)
            shipment.PurchaseInvoices.Add(new OutgoingShipmentPurchaseInvoice
            {
                Id = shipment.PurchaseInvoices.Count + 1,
                PublicId = Guid.NewGuid(),
                OutgoingShipment = shipment,
                Sequence = PurchaseInvoiceSplit.NextSequence(shipment)
            });

        return shipment.PurchaseInvoices.OrderBy(i => i.Sequence).ToList();
    }

    private static OutgoingShipmentPurchaseInvoiceLine AddLine(OutgoingShipmentPurchaseInvoice invoice, long productId, int quantity)
    {
        var line = new OutgoingShipmentPurchaseInvoiceLine
        {
            PublicId = Guid.NewGuid(),
            PurchaseInvoice = invoice,
            ProductId = productId,
            Quantity = quantity
        };

        invoice.Lines.Add(line);
        return line;
    }

    private static OrderItem OrderItemOf(OutgoingShipment shipment, long productId) =>
        shipment.Stops.Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .Single(i => i.ProductId == productId);

    #endregion
}
