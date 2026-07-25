using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Reconciliation is the only place that changes an invoice split implicitly, so it is also
/// the only place drift bugs can hide. Every test asserts the central invariant: the pieces
/// billed across all invoices equal the pieces the shipment carries.
/// </summary>
public sealed class ShipmentInvoiceReconcilerTests
{
    private const long ClientA = 10;
    private const long ClientB = 20;
    private const long ClientC = 30;

    #region first materialisation

    [Fact]
    public void Reconcile_NoInvoicesYet_CreatesOneInvoicePerClientHoldingEverything()
    {
        var shipment = Shipment(
            OrderStop(ClientA, order: 1, (itemId: 1, qty: 10), (itemId: 2, qty: 4)),
            OrderStop(ClientB, order: 2, (itemId: 3, qty: 6)));

        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        shipment.Invoices.Should().HaveCount(2);
        shipment.Invoices.Should().OnlyContain(i => i.Sequence == 1);
        InvoiceFor(shipment, ClientA).Lines.Sum(l => l.Quantity).Should().Be(14);
        InvoiceFor(shipment, ClientB).Lines.Sum(l => l.Quantity).Should().Be(6);
        AssertBalanced(shipment);
        result.Adjustments.Should().BeEmpty("materialising the default split is not drift the user needs told about");
    }

    [Fact]
    public void Reconcile_AlreadyBalanced_ChangesNothing()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        var lineId = InvoiceFor(shipment, ClientA).Lines.Single().PublicId;

        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Single().PublicId.Should().Be(lineId, "a second pass must be a no-op");
        result.Adjustments.Should().BeEmpty();
        result.RemovedLines.Should().BeEmpty();
        result.RemovedInvoices.Should().BeEmpty();
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_NewInvoicesArePublicEntities()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 3)));

        ShipmentInvoiceReconciler.Reconcile(shipment);

        shipment.Invoices.Should().OnlyContain(i => i.PublicId != Guid.Empty);
        shipment.Invoices.SelectMany(i => i.Lines).Should().OnlyContain(l => l.PublicId != Guid.Empty);
    }

    #endregion

    #region quantity drift

    [Fact]
    public void Reconcile_QuantityRaised_SurplusLandsOnOrderingClientsFirstInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientA, quantity: 4, targetSequence: 2);

        OrderItemOf(shipment, itemId: 1).Quantity = 13;
        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(9, "6 kept + 3 added");
        LineOn(shipment, ClientA, sequence: 2, itemId: 1).Quantity.Should().Be(4, "the extra invoice is untouched");
        AssertBalanced(shipment);
        result.Adjustments.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Kind = InvoiceAdjustmentKind.QuantityAdded,
                SourceKind = InvoiceLineSourceKind.OrderItem,
                Quantity = 3
            });
    }

    [Fact]
    public void Reconcile_QuantityCut_TrimsCrossBilledPiecesBeforeTheOwnersOwnClaim()
    {
        // A ordered 10; 3 of them were deliberately billed to B.
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)), OrderStop(ClientB, order: 2));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 3, targetSequence: 1);
        LineOn(shipment, ClientA, 1, 1).Quantity.Should().Be(7);

        // The order drops to 5 — five pieces have to come off somewhere.
        OrderItemOf(shipment, itemId: 1).Quantity = 5;
        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should()
            .Be(5, "the ordering client keeps everything that still exists");
        LinesOn(shipment, ClientB, sequence: 1).Should()
            .BeEmpty("the cross-billed exception is what no longer fits");
        AssertBalanced(shipment);
        result.Adjustments.Should().ContainSingle()
            .Which.Kind.Should().Be(InvoiceAdjustmentKind.QuantityRemoved);
    }

    [Fact]
    public void Reconcile_QuantityCut_TrimsHighestSequenceOfTheOwnerBeforeTheFirst()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientA, quantity: 4, targetSequence: 2);

        OrderItemOf(shipment, itemId: 1).Quantity = 7;
        ShipmentInvoiceReconciler.Reconcile(shipment);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(6, "the first invoice is trimmed last");
        LineOn(shipment, ClientA, sequence: 2, itemId: 1).Quantity.Should().Be(1);
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_QuantityCutBelowCrossBilledTotal_FallsThroughToTheOwnersFirstInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)), OrderStop(ClientB, order: 2));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 4, targetSequence: 1);

        OrderItemOf(shipment, itemId: 1).Quantity = 2;
        ShipmentInvoiceReconciler.Reconcile(shipment);

        LinesOn(shipment, ClientB, sequence: 1).Should().BeEmpty();
        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(2);
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_QuantityCutToZero_DropsEveryLineForThatItem()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5), (itemId: 2, qty: 3)));
        ShipmentInvoiceReconciler.Reconcile(shipment);

        OrderItemOf(shipment, itemId: 1).Quantity = 0;
        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        LinesFor(shipment, itemId: 1).Should().BeEmpty();
        LinesFor(shipment, itemId: 2).Should().ContainSingle().Which.Quantity.Should().Be(3);
        result.RemovedLines.Should().ContainSingle();
        AssertBalanced(shipment);
    }

    #endregion

    #region items and clients leaving the shipment

    [Fact]
    public void Reconcile_SourceItemRemovedFromShipment_DropsItsLinesAndReportsIt()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5), (itemId: 2, qty: 3)));
        ShipmentInvoiceReconciler.Reconcile(shipment);

        var order = shipment.Stops.Single().ClientOrder!;
        var doomed = order.OrderItems.Single(i => i.Id == 2);
        order.OrderItems.Remove(doomed);

        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        LinesFor(shipment, itemId: 2).Should().BeEmpty();
        result.RemovedLines.Should().ContainSingle();
        result.Adjustments.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Kind = InvoiceAdjustmentKind.SourceRemoved,
                SourceKind = InvoiceLineSourceKind.OrderItem,
                Quantity = 3
            });
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_ClientLeavesShipment_DropsTheirEmptyInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)), OrderStop(ClientB, order: 2, (itemId: 2, qty: 4)));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        shipment.Invoices.Should().HaveCount(2);

        var stopB = shipment.Stops.Single(s => s.ClientOrder!.ClientId == ClientB);
        shipment.Stops.Remove(stopB);

        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientA);
        result.RemovedInvoices.Should().ContainSingle();
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_ClientLeavesShipmentButStillHoldsCrossBilledLines_KeepsTheirInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)), OrderStop(ClientB, order: 2, (itemId: 2, qty: 4)));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 3, targetSequence: 1);

        // B's own order leaves, but B is still being billed for 3 pieces of A's.
        var stopB = shipment.Stops.Single(s => s.ClientOrder!.ClientId == ClientB);
        shipment.Stops.Remove(stopB);

        var result = ShipmentInvoiceReconciler.Reconcile(shipment);

        InvoiceFor(shipment, ClientB).Should().NotBeNull("a deliberate cross-client decision must survive");
        LineOn(shipment, ClientB, sequence: 1, itemId: 1).Quantity.Should().Be(3);
        LinesFor(shipment, itemId: 2).Should().BeEmpty("B's own item is gone");
        result.RemovedInvoices.Should().BeEmpty();
        AssertBalanced(shipment);
    }

    #endregion

    #region deleting an invoice

    [Fact]
    public void Reconcile_AfterInvoiceHoldingPiecesIsDeleted_ReturnsThemToTheOrderingClient()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)), OrderStop(ClientB, order: 2));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 4, targetSequence: 1);

        // Deleting an invoice needs no unwind logic — drop it and let reconciliation heal.
        shipment.Invoices.Remove(InvoiceFor(shipment, ClientB));

        ShipmentInvoiceReconciler.Reconcile(shipment);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(10, "pieces come home");
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_AfterOwnersOnlyInvoiceIsDeleted_RecreatesIt()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 6)));
        ShipmentInvoiceReconciler.Reconcile(shipment);
        shipment.Invoices.Clear();

        ShipmentInvoiceReconciler.Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Single().Quantity.Should().Be(6);
        AssertBalanced(shipment);
    }

    #endregion

    #region extra items

    [Fact]
    public void Reconcile_ClientAndCustomExtras_AreBilledToTheirClient()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        shipment.ClientExtraItems.Add(new OutgoingShipmentClientExtraItem
        {
            Id = 100, PublicId = Guid.NewGuid(), ClientId = ClientA, Quantity = 4
        });
        shipment.CustomExtraItems.Add(new OutgoingShipmentCustomExtraItem
        {
            Id = 200, PublicId = Guid.NewGuid(), ClientId = ClientC, Quantity = 2, Description = "Vratné basy"
        });

        ShipmentInvoiceReconciler.Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Sum(l => l.Quantity).Should().Be(9, "5 ordered + 4 from stock");
        InvoiceFor(shipment, ClientA).Lines.Should()
            .Contain(l => l.SourceKind == InvoiceLineSourceKind.ClientExtraItem && l.ClientExtraItemId == 100);
        InvoiceFor(shipment, ClientC).Lines.Should()
            .ContainSingle().Which.CustomExtraItemId.Should().Be(200, "a custom extra creates an invoice for its client");
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_InventoryExtras_AreNeverInvoiced()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        shipment.InventoryExtraItems.Add(new OutgoingShipmentInventoryExtraItem
        {
            Id = 300, PublicId = Guid.NewGuid(), Quantity = 12
        });

        ShipmentInvoiceReconciler.Reconcile(shipment);

        shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should()
            .Be(5, "goods returning to our own stock are not billable");
    }

    [Fact]
    public void Reconcile_ExtraWithoutAClient_IsSkippedRatherThanGuessedAt()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        shipment.CustomExtraItems.Add(new OutgoingShipmentCustomExtraItem
        {
            Id = 400, PublicId = Guid.NewGuid(), ClientId = null, Quantity = 3, Description = "Nepřiřazeno"
        });

        ShipmentInvoiceReconciler.Reconcile(shipment);

        shipment.Invoices.SelectMany(i => i.Lines).Should()
            .NotContain(l => l.SourceKind == InvoiceLineSourceKind.CustomExtraItem);
        shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(5);
    }

    #endregion

    #region misuse

    [Fact]
    public void Reconcile_UnsavedSourceItem_FailsLoudly()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 0, qty: 5)));

        var act = () => ShipmentInvoiceReconciler.Reconcile(shipment);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*must be persisted*", "silently merging two unsaved items' splits would be far worse");
    }

    [Fact]
    public void NextSequenceFor_CountsPerClient()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 1)), OrderStop(ClientB, order: 2, (itemId: 2, qty: 1)));
        ShipmentInvoiceReconciler.Reconcile(shipment);

        ShipmentInvoiceReconciler.NextSequenceFor(shipment, ClientA).Should().Be(2);
        ShipmentInvoiceReconciler.NextSequenceFor(shipment, ClientC).Should().Be(1, "a client with no invoice starts at 1");
    }

    #endregion

    #region helpers

    /// <summary>Total pieces billed must always equal total pieces carried.</summary>
    private static void AssertBalanced(OutgoingShipment shipment)
    {
        var carried =
            shipment.Stops.Where(s => s.ClientOrder is not null).SelectMany(s => s.ClientOrder!.OrderItems).Sum(i => i.Quantity)
            + shipment.ClientExtraItems.Where(i => i.ClientId is not null).Sum(i => i.Quantity)
            + shipment.CustomExtraItems.Where(i => i.ClientId is not null).Sum(i => i.Quantity);

        shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should()
            .Be(carried, "every billable piece must be covered by exactly one invoice line");
        shipment.Invoices.SelectMany(i => i.Lines).Should().OnlyContain(l => l.Quantity > 0,
            "emptied lines must be dropped, not left at zero");
    }

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

    private static OutgoingShipmentStop OrderStop(long clientId, int order, params (long itemId, int qty)[] items)
    {
        var clientOrder = new Order
        {
            Id = clientId * 1000 + order,
            PublicId = Guid.NewGuid(),
            ClientId = clientId
        };

        foreach (var (itemId, qty) in items)
        {
            clientOrder.OrderItems.Add(new OrderItem
            {
                Id = itemId,
                PublicId = Guid.NewGuid(),
                OrderId = clientOrder.Id,
                Quantity = qty
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

    /// <summary>
    /// Mimics what the move endpoint does, so the tests exercise reconciliation against splits
    /// that were produced the same way real ones are.
    /// </summary>
    private static void MovePieces(OutgoingShipment shipment, long itemId, long from, long to, int quantity, int targetSequence)
    {
        var source = LineOn(shipment, from, sequence: 1, itemId: itemId);
        var target = shipment.Invoices.FirstOrDefault(i => i.ClientId == to && i.Sequence == targetSequence);
        if (target is null)
        {
            target = new OutgoingShipmentInvoice
            {
                PublicId = Guid.NewGuid(), OutgoingShipment = shipment, ClientId = to, Sequence = targetSequence
            };
            shipment.Invoices.Add(target);
        }

        var existing = target.Lines.FirstOrDefault(l => l.OrderItemId == itemId);
        if (existing is not null)
            existing.Quantity += quantity;
        else
            target.Lines.Add(new OutgoingShipmentInvoiceLine
            {
                PublicId = Guid.NewGuid(),
                SourceKind = InvoiceLineSourceKind.OrderItem,
                OrderItemId = itemId,
                Quantity = quantity
            });

        source.Quantity -= quantity;
        if (source.Quantity <= 0)
            shipment.Invoices.Single(i => i.ClientId == from && i.Sequence == 1).Lines.Remove(source);
    }

    private static OutgoingShipmentInvoice InvoiceFor(OutgoingShipment shipment, long clientId) =>
        shipment.Invoices.Single(i => i.ClientId == clientId && i.Sequence == 1);

    private static OrderItem OrderItemOf(OutgoingShipment shipment, long itemId) =>
        shipment.Stops.Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .Single(i => i.Id == itemId);

    private static OutgoingShipmentInvoiceLine LineOn(OutgoingShipment shipment, long clientId, int sequence, long itemId) =>
        shipment.Invoices.Single(i => i.ClientId == clientId && i.Sequence == sequence)
            .Lines.Single(l => l.OrderItemId == itemId);

    private static List<OutgoingShipmentInvoiceLine> LinesOn(OutgoingShipment shipment, long clientId, int sequence) =>
        shipment.Invoices.Where(i => i.ClientId == clientId && i.Sequence == sequence)
            .SelectMany(i => i.Lines).ToList();

    private static List<OutgoingShipmentInvoiceLine> LinesFor(OutgoingShipment shipment, long itemId) =>
        shipment.Invoices.SelectMany(i => i.Lines).Where(l => l.OrderItemId == itemId).ToList();

    #endregion
}
