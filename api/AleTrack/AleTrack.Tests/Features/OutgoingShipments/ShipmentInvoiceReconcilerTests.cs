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

        var result = Reconcile(shipment);

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
        Reconcile(shipment);
        var lineId = InvoiceFor(shipment, ClientA).Lines.Single().PublicId;

        var result = Reconcile(shipment);

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

        Reconcile(shipment);

        shipment.Invoices.Should().OnlyContain(i => i.PublicId != Guid.Empty);
        shipment.Invoices.SelectMany(i => i.Lines).Should().OnlyContain(l => l.PublicId != Guid.Empty);
    }

    [Fact]
    public void Reconcile_NewInvoiceGetsItsClientNavigationFilled()
    {
        // The response is mapped from this same in-memory graph, so a created invoice with only
        // ClientId set would surface as a blank client name on the first read after materialising.
        var client = new Client { Id = ClientA, PublicId = Guid.NewGuid(), Name = "Klient A" };
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 3)));
        shipment.Stops.Single().ClientOrder!.Client = client;

        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Client.Should().BeSameAs(client);
    }

    #endregion

    #region quantity drift

    [Fact]
    public void Reconcile_QuantityRaised_SurplusLandsOnOrderingClientsFirstInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientA, quantity: 4, targetSequence: 2);

        OrderItemOf(shipment, itemId: 1).Quantity = 13;
        var result = Reconcile(shipment);

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
        Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 3, targetSequence: 1);
        LineOn(shipment, ClientA, 1, 1).Quantity.Should().Be(7);

        // The order drops to 5 — five pieces have to come off somewhere.
        OrderItemOf(shipment, itemId: 1).Quantity = 5;
        var result = Reconcile(shipment);

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
        Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientA, quantity: 4, targetSequence: 2);

        OrderItemOf(shipment, itemId: 1).Quantity = 7;
        Reconcile(shipment);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(6, "the first invoice is trimmed last");
        LineOn(shipment, ClientA, sequence: 2, itemId: 1).Quantity.Should().Be(1);
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_QuantityCutBelowCrossBilledTotal_FallsThroughToTheOwnersFirstInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)), OrderStop(ClientB, order: 2));
        Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 4, targetSequence: 1);

        OrderItemOf(shipment, itemId: 1).Quantity = 2;
        Reconcile(shipment);

        LinesOn(shipment, ClientB, sequence: 1).Should().BeEmpty();
        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(2);
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_QuantityCutToZero_DropsEveryLineForThatItem()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5), (itemId: 2, qty: 3)));
        Reconcile(shipment);

        OrderItemOf(shipment, itemId: 1).Quantity = 0;
        var result = Reconcile(shipment);

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
        Reconcile(shipment);

        var order = shipment.Stops.Single().ClientOrder!;
        var doomed = order.OrderItems.Single(i => i.Id == 2);
        order.OrderItems.Remove(doomed);

        var result = Reconcile(shipment);

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
        Reconcile(shipment);
        shipment.Invoices.Should().HaveCount(2);

        var stopB = shipment.Stops.Single(s => s.ClientOrder!.ClientId == ClientB);
        shipment.Stops.Remove(stopB);

        var result = Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientA);
        result.RemovedInvoices.Should().ContainSingle();
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_ClientLeavesShipmentButStillHoldsCrossBilledLines_KeepsTheirInvoice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)), OrderStop(ClientB, order: 2, (itemId: 2, qty: 4)));
        Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 3, targetSequence: 1);

        // B's own order leaves, but B is still being billed for 3 pieces of A's.
        var stopB = shipment.Stops.Single(s => s.ClientOrder!.ClientId == ClientB);
        shipment.Stops.Remove(stopB);

        var result = Reconcile(shipment);

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
        Reconcile(shipment);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 4, targetSequence: 1);

        // Deleting an invoice needs no unwind logic — drop it and let reconciliation heal.
        shipment.Invoices.Remove(InvoiceFor(shipment, ClientB));

        Reconcile(shipment);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(10, "pieces come home");
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_AfterOwnersOnlyInvoiceIsDeleted_RecreatesIt()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 6)));
        Reconcile(shipment);
        shipment.Invoices.Clear();

        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Single().Quantity.Should().Be(6);
        AssertBalanced(shipment);
    }

    #endregion

    #region extra items

    [Fact]
    public void Reconcile_StockSourcingIsNotBilled_ButCustomExtrasAre()
    {
        var stopA = OrderStop(ClientA, order: 1, (itemId: 1, qty: 5));
        var stopC = OrderStop(ClientC, order: 2);
        var shipment = Shipment(stopA, stopC);

        // Two of client A's five pieces come out of our own stock. That is sourcing,
        // not extra quantity, so the invoice still shows five.
        stopA.ClientOrder!.OrderItems.Single().QuantityFromInventory = 2;

        stopC.ClientOrder!.CustomExtraItems.Add(new OrderCustomExtraItem
        {
            Id = 200, PublicId = Guid.NewGuid(), Quantity = 2, Description = "Vratné basy"
        });

        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Sum(l => l.Quantity).Should()
            .Be(5, "sourcing from stock does not add billable pieces");
        InvoiceFor(shipment, ClientC).Lines.Should()
            .ContainSingle().Which.CustomExtraItemId.Should().Be(200, "a custom extra is billed to its order's client");
        AssertBalanced(shipment);
    }

    /// <summary>
    /// A supplier good is something the client ordered, so it is billed like the beer beside it.
    /// </summary>
    [Fact]
    public void Reconcile_SupplierGood_IsBilledToTheOrderingClient()
    {
        var stop = OrderStop(ClientA, order: 1, (itemId: 1, qty: 5));
        var shipment = Shipment(stop);
        stop.ClientOrder!.SupplierGoodItems.Add(SupplierGoodItem(id: 700, quantity: 2));

        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Should()
            .ContainSingle(l => l.SourceKind == InvoiceLineSourceKind.SupplierGoodItem)
            .Which.SupplierGoodItemId.Should().Be(700);
        InvoiceFor(shipment, ClientA).Lines.Sum(l => l.Quantity).Should().Be(7, "5 ordered + 2 off the price list");
        AssertBalanced(shipment);
    }

    /// <summary>
    /// The garage/supplier split says where the van collects the pieces, not how many the client
    /// gets — so all of them are billed, exactly as an order item's are when sourced from stock.
    /// </summary>
    [Fact]
    public void Reconcile_SupplierGoodTakenFromTheGarage_IsStillBilledInFull()
    {
        var stop = OrderStop(ClientA, order: 1);
        var shipment = Shipment(stop);
        var item = SupplierGoodItem(id: 710, quantity: 4);
        item.QuantityFromGarage = 4;
        stop.ClientOrder!.SupplierGoodItems.Add(item);

        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines.Sum(l => l.Quantity).Should().Be(4);
        AssertBalanced(shipment);
    }

    /// <summary>
    /// Its name carries the size, because that is what tells two goods of one name apart, and its
    /// price is the one the order line is quoted at — the good's Plnění row.
    /// </summary>
    [Fact]
    public void Reconcile_SupplierGoodLine_RecordsNameWithSizeAndTheRefillPrice()
    {
        var stop = OrderStop(ClientA, order: 1);
        var shipment = Shipment(stop);
        var item = SupplierGoodItem(id: 720, quantity: 1);
        // Deliberately after the purchase row, so picking "the first price" would take 1800.
        item.SupplierGood.Prices =
        [
            new SupplierGoodPrice { Kind = SupplierChargeKind.Purchase, PriceWithVat = 1800m, PriceWithoutVat = 1487.60m },
            new SupplierGoodPrice { Kind = SupplierChargeKind.Fill, PriceWithVat = 450m, PriceWithoutVat = 371.90m }
        ];
        stop.ClientOrder!.SupplierGoodItems.Add(item);

        Reconcile(shipment);

        var line = InvoiceFor(shipment, ClientA).Lines
            .Single(l => l.SourceKind == InvoiceLineSourceKind.SupplierGoodItem);
        line.ProductName.Should().Be("CO₂ láhev 10 kg");
        line.Kind.Should().BeNull();
        line.PackageSize.Should().BeNull();
        line.UnitPriceWithVat.Should().Be(450m, "the same price the order line shows");
        line.UnitPriceWithoutVat.Should().Be(371.90m);
    }

    /// <summary>
    /// A good that prices no refill — a crate that is only ever bought — is billed at what it does
    /// price.
    /// </summary>
    [Fact]
    public void Reconcile_SupplierGoodWithNoRefillPrice_IsBilledAtItsFirstOne()
    {
        var stop = OrderStop(ClientA, order: 1);
        var shipment = Shipment(stop);
        var item = SupplierGoodItem(id: 721, quantity: 1);
        item.SupplierGood.Prices =
        [
            new SupplierGoodPrice { Kind = SupplierChargeKind.Purchase, PriceWithVat = 1800m }
        ];
        stop.ClientOrder!.SupplierGoodItems.Add(item);

        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines
            .Single(l => l.SourceKind == InvoiceLineSourceKind.SupplierGoodItem)
            .UnitPriceWithVat.Should().Be(1800m);
    }

    /// <summary>
    /// And a repriced good does not restate an invoice already issued — the same freeze an order
    /// item's price gets.
    /// </summary>
    [Fact]
    public void Reconcile_LoadedShipment_DoesNotRepriceASupplierGoodLine()
    {
        var stop = OrderStop(ClientA, order: 1);
        var shipment = Shipment(stop);
        var item = SupplierGoodItem(id: 722, quantity: 2);
        stop.ClientOrder!.SupplierGoodItems.Add(item);
        Reconcile(shipment);

        shipment.State = OutgoingShipmentState.Loaded;
        item.SupplierGood.Prices.Single().PriceWithVat = 999m;
        Reconcile(shipment);

        InvoiceFor(shipment, ClientA).Lines
            .Single(l => l.SourceKind == InvoiceLineSourceKind.SupplierGoodItem)
            .UnitPriceWithVat.Should().Be(450m, "an issued line is frozen");
    }

    /// <summary>
    /// The line that was moved somewhere by hand stays where it was put — the same guarantee the
    /// other two source kinds get, and the one a second reconcile pass could quietly undo.
    /// </summary>
    [Fact]
    public void Reconcile_SupplierGoodMarkedPrivate_StaysPrivate()
    {
        var stop = OrderStop(ClientA, order: 1);
        var shipment = Shipment(stop);
        stop.ClientOrder!.SupplierGoodItems.Add(SupplierGoodItem(id: 730, quantity: 3));
        var split = ShipmentInvoiceSplit.Of(shipment);
        ShipmentInvoiceReconciler.Reconcile(split);

        // As the move endpoint does it: off the invoice, onto a line with no invoice.
        var billed = InvoiceFor(shipment, ClientA).Lines.Single();
        InvoiceFor(shipment, ClientA).Lines.Remove(billed);
        split.PrivateLines.Add(new OutgoingShipmentInvoiceLine
        {
            PublicId = Guid.NewGuid(),
            IsPrivate = true,
            SourceKind = InvoiceLineSourceKind.SupplierGoodItem,
            SupplierGoodItemId = 730,
            Quantity = 3
        });

        var result = ShipmentInvoiceReconciler.Reconcile(split);

        split.PrivateLines.Should().ContainSingle().Which.Quantity.Should().Be(3);
        InvoiceFor(shipment, ClientA).Lines.Should().BeEmpty("the pieces are accounted for, just not billed");
        result.Adjustments.Should().BeEmpty();
        AssertBalanced(split);
    }

    /// <summary>
    /// And when the line leaves the order, its billing goes with it rather than pointing at
    /// nothing.
    /// </summary>
    [Fact]
    public void Reconcile_SupplierGoodRemovedFromTheOrder_DropsItsLine()
    {
        var stop = OrderStop(ClientA, order: 1, (itemId: 1, qty: 2));
        var shipment = Shipment(stop);
        stop.ClientOrder!.SupplierGoodItems.Add(SupplierGoodItem(id: 740, quantity: 6));
        Reconcile(shipment);

        stop.ClientOrder.SupplierGoodItems.Clear();
        var result = ShipmentInvoiceReconciler.Reconcile(ShipmentInvoiceSplit.Of(shipment));

        InvoiceFor(shipment, ClientA).Lines.Should()
            .NotContain(l => l.SourceKind == InvoiceLineSourceKind.SupplierGoodItem);
        result.Adjustments.Should().ContainSingle(a =>
            a.Kind == InvoiceAdjustmentKind.SourceRemoved
            && a.SourceKind == InvoiceLineSourceKind.SupplierGoodItem
            && a.Quantity == 6);
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_StockPurchases_AreNeverInvoiced()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            Id = 300, PublicId = Guid.NewGuid(), Quantity = 12
        });

        Reconcile(shipment);

        shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should()
            .Be(5, "goods returning to our own stock are not billable");
    }

    [Fact]
    public void Reconcile_EveryCustomExtraIsBilled_BecauseItAlwaysHasAClient()
    {
        // Replaces the old "extra without a client is skipped" case: that state was only
        // reachable while extras hung off the shipment with a nullable ClientId. Owned by
        // an order, an extra always has a client, so none can be skipped.
        var stop = OrderStop(ClientA, order: 1, (itemId: 1, qty: 5));
        var shipment = Shipment(stop);
        stop.ClientOrder!.CustomExtraItems.Add(new OrderCustomExtraItem
        {
            Id = 400, PublicId = Guid.NewGuid(), Quantity = 3, Description = "Přiřazeno objednávkou"
        });

        Reconcile(shipment);

        shipment.Invoices.SelectMany(i => i.Lines).Should()
            .ContainSingle(l => l.SourceKind == InvoiceLineSourceKind.CustomExtraItem);
        shipment.Invoices.SelectMany(i => i.Lines).Sum(l => l.Quantity).Should().Be(8, "5 ordered + 3 custom");
        AssertBalanced(shipment);
    }

    #endregion

    #region private pieces

    [Fact]
    public void Reconcile_PrivatePieces_CountAsCoveredAndAreLeftAlone()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 4);

        var result = Reconcile(split);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(6);
        split.PrivateLines.Single().Quantity.Should().Be(4, "private pieces are accounted for, just not billed");
        result.Adjustments.Should().BeEmpty("nothing drifted — the pieces are all still covered");
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_QuantityDroppedBelowTheSplit_TrimsPrivatePiecesFirst()
    {
        // Losing the private mark is the mildest of the three failures: it shows up on the invoice
        // and in the drift banner, whereas silently un-billing pieces costs money nobody notices.
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 8);

        OrderItemOf(shipment, 1).Quantity = 3;
        var result = Reconcile(split);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(2, "the billed pieces survive untouched");
        split.PrivateLines.Single().Quantity.Should().Be(1);
        result.Adjustments.Should().ContainSingle(a => a.Kind == InvoiceAdjustmentKind.QuantityRemoved && a.Quantity == 7);
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_PrivatePiecesTrimmedBeforeCrossBilledOnes()
    {
        var shipment = Shipment(
            OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)),
            OrderStop(ClientB, order: 2, (itemId: 2, qty: 1)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MovePieces(shipment, itemId: 1, from: ClientA, to: ClientB, quantity: 3, targetSequence: 1);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 2);

        // 5 on A's invoice, 3 cross-billed to B, 2 private. Two pieces vanish.
        OrderItemOf(shipment, 1).Quantity = 8;
        Reconcile(split);

        split.PrivateLines.Should().BeEmpty("private goes first");
        LineOn(shipment, ClientB, sequence: 1, itemId: 1).Quantity.Should().Be(3, "the cross-billed pieces are untouched");
        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(5);
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_PrivatePiecesEmptiedCompletely_DropsTheLine()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 4);
        var privateLine = split.PrivateLines.Single();

        OrderItemOf(shipment, 1).Quantity = 6;
        var result = Reconcile(split);

        split.PrivateLines.Should().BeEmpty();
        result.RemovedLines.Should().Contain(privateLine, "the caller has to delete it — nothing cascades it away");
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_SourceItemLeftTheShipment_DropsItsPrivateLineToo()
    {
        var stop = OrderStop(ClientA, order: 1, (itemId: 1, qty: 10), (itemId: 2, qty: 5));
        var shipment = Shipment(stop);
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 2, fromClientId: ClientA, quantity: 5);

        var removed = OrderItemOf(shipment, 2);
        stop.ClientOrder!.OrderItems.Remove(removed);
        var result = Reconcile(split);

        split.PrivateLines.Should().BeEmpty("the pieces are gone, so there is nothing left to keep off an invoice");
        result.Adjustments.Should().ContainSingle(a => a.Kind == InvoiceAdjustmentKind.SourceRemoved && a.Quantity == 5);
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_QuantityRaised_AddsToTheInvoiceNeverToThePrivatePieces()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 10)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 4);

        OrderItemOf(shipment, 1).Quantity = 14;
        var result = Reconcile(split);

        LineOn(shipment, ClientA, sequence: 1, itemId: 1).Quantity.Should().Be(10, "surplus is billed");
        split.PrivateLines.Single().Quantity.Should().Be(4, "pieces only become private when the user says so");
        result.Adjustments.Should().ContainSingle(a => a.Kind == InvoiceAdjustmentKind.QuantityAdded && a.Quantity == 4);
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_EveryPieceOfAClientIsPrivate_KeepsTheirEmptyFirstInvoice()
    {
        // It is where un-marking returns the pieces to, and the UI shows it as an empty invoice.
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 5);

        var result = Reconcile(split);

        InvoiceFor(shipment, ClientA).Lines.Should().BeEmpty();
        result.RemovedInvoices.Should().BeEmpty();
        AssertBalanced(split);
    }

    #endregion

    #region misuse

    [Fact]
    public void Reconcile_UnsavedSourceItem_FailsLoudly()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 0, qty: 5)));

        var act = () => Reconcile(shipment);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*must be persisted*", "silently merging two unsaved items' splits would be far worse");
    }

    [Fact]
    public void NextSequenceFor_CountsPerClient()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 1)), OrderStop(ClientB, order: 2, (itemId: 2, qty: 1)));
        Reconcile(shipment);

        ShipmentInvoiceReconciler.NextSequenceFor(shipment, ClientA).Should().Be(2);
        ShipmentInvoiceReconciler.NextSequenceFor(shipment, ClientC).Should().Be(1, "a client with no invoice starts at 1");
    }

    #endregion

    #region payer redirect

    [Fact]
    public void Reconcile_SubClientItems_OpenTheInvoiceForItsPayer()
    {
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 10)));

        var result = Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientC);
        InvoiceFor(shipment, ClientC).Lines.Should()
            .OnlyContain(l => OrderingClientIdOf(shipment, l) == ClientA,
                "the pieces are still the sub-client's; only the bill moved");
        result.RemovedInvoices.Should().BeEmpty(
            "the payer counts as a client with a stake in the run, so the invoice opened for it "
            + "must not be pruned and re-created within the same pass");
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_TwoSubClientsOfOnePayer_ShareOneInvoice()
    {
        var payer = Payer(ClientC);
        var shipment = Shipment(
            OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 4)),
            OrderStop(ClientB, order: 2, SubClient(ClientB, payer), (itemId: 2, qty: 6)));

        Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientC);
        InvoiceFor(shipment, ClientC).Lines.Sum(l => l.Quantity).Should().Be(10);
        InvoiceFor(shipment, ClientC).Lines.Select(l => OrderingClientIdOf(shipment, l))
            .Should().BeEquivalentTo(new[] { ClientA, ClientB });
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_PayerInvoiceGetsThePayerClientNavigation()
    {
        // The response is mapped from this same graph, so a payer invoice with only ClientId set
        // would surface as a blank client name on the first read.
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 3)));

        Reconcile(shipment);

        InvoiceFor(shipment, ClientC).Client.Should().BeSameAs(payer);
    }

    [Fact]
    public void Reconcile_ExistingSubClientInvoice_IsLeftAlone()
    {
        // A run split before the relation existed must not have its invoices re-pointed
        // mid-flight: that would move money between clients without anyone asking.
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        Reconcile(shipment);
        var existing = InvoiceFor(shipment, ClientA).PublicId;

        shipment.Stops.Single().ClientOrder!.Client = SubClient(ClientA, payer);
        var result = Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.PublicId.Should().Be(existing);
        InvoiceFor(shipment, ClientA).ClientId.Should().Be(ClientA);
        result.Adjustments.Should().BeEmpty();
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_SubClientQuantityDrops_TrimsItsOwnPayerInvoiceLast()
    {
        // TrimRank must rank the payer's invoice as the sub-client's *own* home, not as
        // "somebody else's" — otherwise a drop empties the line that should survive. The
        // cross-billed pieces on B are what makes the ranking observable: with a single
        // placement the trim order cannot be seen at all.
        //
        // The payer's home deliberately sits at sequence 2 and the cross-billed exception at
        // sequence 1. An ordering-client comparison ranks both placements the same, so the tie
        // falls through to ThenByDescending(Sequence) and reaches the payer's invoice first — by
        // the sequence numbers alone, not by the order shipment.Invoices happens to be in. Were
        // the home at sequence 1 the two would tie outright, and a stable sort visiting the
        // stranger first would mask the bug.
        var payer = Payer(ClientC);
        var sub = SubClient(ClientA, payer);
        var stop = OrderStop(ClientA, order: 1, sub, (itemId: 1, qty: 10));
        var shipment = Shipment(stop, OrderStop(ClientB, order: 2));
        Reconcile(shipment);

        // 3 pieces cross-billed to B, the other 7 moved to a second invoice of the payer, whose
        // emptied first invoice is then deleted — leaving the payer's home at sequence 2.
        MovePieces(shipment, itemId: 1, from: ClientC, to: ClientB, quantity: 3, targetSequence: 1);
        MovePieces(shipment, itemId: 1, from: ClientC, to: ClientC, quantity: 7, targetSequence: 2);
        shipment.Invoices.Remove(InvoiceFor(shipment, ClientC));

        stop.ClientOrder!.OrderItems.Single().Quantity = 4;
        Reconcile(shipment);

        LineOn(shipment, ClientC, sequence: 2, itemId: 1).Quantity.Should()
            .Be(4, "the payer's invoice is the sub-client's own home, trimmed last");
        LinesOn(shipment, ClientB, sequence: 1).Should()
            .BeEmpty("the cross-billed exception is what no longer fits");
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_EveryPieceOfASubClientIsPrivate_KeepsItsEmptyInvoice()
    {
        // The payer redirect makes the sub-client no longer the client billed, but it still
        // orders on this run, so it keeps its stake: the invoice it already holds is where
        // un-marking returns the pieces to, and the UI shows it as an empty invoice. The
        // pre-payer counterpart of this is Reconcile_EveryPieceOfAClientIsPrivate_*.
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        var split = ShipmentInvoiceSplit.Of(shipment);
        Reconcile(split);
        MarkPrivate(split, itemId: 1, fromClientId: ClientA, quantity: 5);

        shipment.Stops.Single().ClientOrder!.Client = SubClient(ClientA, payer);
        var result = Reconcile(split);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should()
            .Be(ClientA, "the sub-client's own invoice must survive, not merely the balance");
        InvoiceFor(shipment, ClientA).Lines.Should().BeEmpty();
        result.RemovedInvoices.Should().BeEmpty();
        AssertBalanced(split);
    }

    [Fact]
    public void Reconcile_InvoiceOpenedForASubClient_SurvivesTheNextPass()
    {
        // A sub-client has a stop, so it is an eligible client and the add-invoice endpoint
        // accepts it. The invoice it opens is empty until the user moves pieces onto it, and the
        // very next read must not silently undo an explicit user action.
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 6)));
        Reconcile(shipment);

        shipment.Invoices.Add(new OutgoingShipmentInvoice
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipment = shipment,
            ClientId = ClientA,
            Sequence = ShipmentInvoiceReconciler.NextSequenceFor(shipment, ClientA)
        });

        var result = Reconcile(shipment);

        shipment.Invoices.Should().HaveCount(2);
        InvoiceFor(shipment, ClientA).Lines.Should().BeEmpty("it is empty until the user fills it");
        InvoiceFor(shipment, ClientC).Lines.Sum(l => l.Quantity).Should().Be(6);
        result.RemovedInvoices.Should().BeEmpty();
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_ClientWithoutPayer_IsUnchanged()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, Payer(ClientA), (itemId: 1, qty: 7)));

        Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientA);
        AssertBalanced(shipment);
    }

    #endregion

    #region helpers

    /// <summary>
    /// Reconciles a shipment that has no pieces excluded from invoicing — the vast majority of
    /// cases. Tests that need private pieces build a split and use the overload below.
    /// </summary>
    private static ReconcileResult Reconcile(OutgoingShipment shipment) =>
        ShipmentInvoiceReconciler.Reconcile(ShipmentInvoiceSplit.Of(shipment));

    private static ReconcileResult Reconcile(ShipmentInvoiceSplit split) =>
        ShipmentInvoiceReconciler.Reconcile(split);

    /// <summary>Total pieces billed must always equal total pieces carried.</summary>
    private static void AssertBalanced(OutgoingShipment shipment) =>
        AssertBalanced(ShipmentInvoiceSplit.Of(shipment));

    /// <summary>
    /// Total pieces billed plus pieces excluded from invoicing must equal pieces carried.
    /// </summary>
    private static void AssertBalanced(ShipmentInvoiceSplit split)
    {
        var shipment = split.Shipment;
        var orders = shipment.Stops.Where(s => s.ClientOrder is not null).Select(s => s.ClientOrder!).ToList();
        var carried =
            orders.SelectMany(o => o.OrderItems).Sum(i => i.Quantity)
            + orders.SelectMany(o => o.CustomExtraItems).Sum(i => i.Quantity)
            + orders.SelectMany(o => o.SupplierGoodItems).Sum(i => i.Quantity);

        var lines = shipment.Invoices.SelectMany(i => i.Lines).Concat(split.PrivateLines).ToList();

        lines.Sum(l => l.Quantity).Should()
            .Be(carried, "every billable piece must be covered by exactly one line, billed or private");
        lines.Should().OnlyContain(l => l.Quantity > 0,
            "emptied lines must be dropped, not left at zero");
    }

    /// <summary>
    /// Mimics the move endpoint marking pieces private: they come off an invoice line and become
    /// a line with no invoice.
    /// </summary>
    private static void MarkPrivate(ShipmentInvoiceSplit split, long itemId, long fromClientId, int quantity)
    {
        var source = LineOn(split.Shipment, fromClientId, sequence: 1, itemId: itemId);
        source.Quantity -= quantity;
        if (source.Quantity <= 0)
            split.Shipment.Invoices.Single(i => i.ClientId == fromClientId && i.Sequence == 1).Lines.Remove(source);

        split.PrivateLines.Add(new OutgoingShipmentInvoiceLine
        {
            PublicId = Guid.NewGuid(),
            IsPrivate = true,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            OrderItemId = itemId,
            Quantity = quantity
        });
    }

    /// <summary>
    /// One line off a supplier's price list, with the good loaded — the graph the invoicing
    /// endpoints hand reconciliation, which reads the good for the line's name.
    /// </summary>
    private static OrderSupplierGoodItem SupplierGoodItem(long id, int quantity) =>
        new()
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            Quantity = quantity,
            SupplierGood = new SupplierGood
            {
                Id = id * 10, PublicId = Guid.NewGuid(), Name = "CO₂ láhev", Size = "10 kg",
                Prices =
                [
                    new SupplierGoodPrice { Kind = SupplierChargeKind.Fill, PriceWithVat = 450m }
                ]
            }
        };

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


    /// <summary>Same stop, with the ordering client's entity loaded on its order.</summary>
    private static OutgoingShipmentStop OrderStop(
        long clientId,
        int order,
        Client? client,
        params (long itemId, int qty)[] items)
    {
        var stop = OrderStop(clientId, order, items);
        stop.ClientOrder!.Client = client!;
        return stop;
    }

    /// <summary>A client billed through <paramref name="payer"/>.</summary>
    private static Client SubClient(long id, Client payer) =>
        new()
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            Name = $"Sub {id}",
            InvoicingClientId = payer.Id,
            InvoicingClient = payer
        };

    private static Client Payer(long id) =>
        new() { Id = id, PublicId = Guid.NewGuid(), Name = $"Payer {id}" };

    /// <summary>
    /// The client whose order a line bills for, derived the way the mapper derives it — the line
    /// does not store it.
    /// </summary>
    private static long OrderingClientIdOf(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line) =>
        ShipmentInvoiceGraph.OrderOf(shipment, line.OrderItemId ?? 0)!.ClientId;

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

    #region what a line records about what it bills

    /// <summary>
    /// While the run is still being planned the live product is the current truth, so that is what
    /// a new line records.
    /// </summary>
    [Fact]
    public void Reconcile_CreatedShipment_RecordsTheLiveProduct()
    {
        var shipment = PricedShipment(OutgoingShipmentState.Created, livePrice: 11.49m, snapshotPrice: null);

        Reconcile(shipment);

        var line = InvoiceFor(shipment, ClientA).Lines.Single();
        line.ProductName.Should().Be("Albrecht 12°");
        line.Kind.Should().Be(ProductKind.Bottle);
        line.PackageSize.Should().Be(0.5);
        line.UnitPriceWithVat.Should().Be(11.49m);
    }

    /// <summary>
    /// From Loaded onward the run's own snapshot is the truth, and the product may already have
    /// moved on.
    /// </summary>
    [Fact]
    public void Reconcile_LoadedShipment_RecordsTheStopItemNotTheLiveProduct()
    {
        var shipment = PricedShipment(OutgoingShipmentState.Loaded, livePrice: 99m, snapshotPrice: 11.49m);

        Reconcile(shipment);

        var line = InvoiceFor(shipment, ClientA).Lines.Single();
        line.UnitPriceWithVat.Should().Be(11.49m, "the run recorded this price when it was packed");
        line.ProductName.Should().Be("Albrecht 12°");
    }

    /// <summary>
    /// A planned run's invoices should follow a price correction — nothing has been issued yet.
    /// </summary>
    [Fact]
    public void Reconcile_CreatedShipment_RefreshesAnExistingLine()
    {
        var shipment = PricedShipment(OutgoingShipmentState.Created, livePrice: 11.49m, snapshotPrice: null);
        Reconcile(shipment);

        ProductOf(shipment).PriceWithVat = 99m;
        ProductOf(shipment).Name = "Přejmenováno";
        Reconcile(shipment);

        var line = InvoiceFor(shipment, ClientA).Lines.Single();
        line.UnitPriceWithVat.Should().Be(99m);
        line.ProductName.Should().Be("Přejmenováno");
    }

    /// <summary>
    /// The billing correctness bug from #25: an issued invoice must not follow the product.
    /// </summary>
    [Fact]
    public void Reconcile_LoadedShipment_DoesNotRefreshAnExistingLine()
    {
        var shipment = PricedShipment(OutgoingShipmentState.Loaded, livePrice: 11.49m, snapshotPrice: 11.49m);
        Reconcile(shipment);

        // As if the product had been repriced and the run's snapshot rebuilt around it.
        ProductOf(shipment).PriceWithVat = 99m;
        StopItemOf(shipment).UnitPriceWithVat = 99m;
        StopItemOf(shipment).ProductName = "Přejmenováno";
        Reconcile(shipment);

        var line = InvoiceFor(shipment, ClientA).Lines.Single();
        line.UnitPriceWithVat.Should().Be(11.49m, "an issued line is frozen");
        line.ProductName.Should().Be("Albrecht 12°");
    }

    [Fact]
    public void Reconcile_CustomExtraLine_RecordsTheDescriptionAndNoPrice()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1));
        var order = shipment.Stops.Single().ClientOrder!;
        order.CustomExtraItems.Add(new OrderCustomExtraItem
        {
            Id = 900,
            PublicId = Guid.NewGuid(),
            Description = "Tácky",
            Quantity = 100
        });

        Reconcile(shipment);

        var line = InvoiceFor(shipment, ClientA).Lines
            .Single(l => l.SourceKind == InvoiceLineSourceKind.CustomExtraItem);
        line.ProductName.Should().Be("Tácky");
        line.Kind.Should().BeNull();
        line.UnitPriceWithVat.Should().BeNull();
    }

    /// <summary>
    /// A run in <paramref name="state"/> carrying one bottle line for client A. When
    /// <paramref name="snapshotPrice"/> is given the stop also carries the snapshot a loaded run
    /// would have written, so the two sources can be told apart.
    /// </summary>
    private static OutgoingShipment PricedShipment(
        OutgoingShipmentState state, decimal livePrice, decimal? snapshotPrice)
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 6)));
        shipment.State = state;

        var stop = shipment.Stops.Single();
        var item = stop.ClientOrder!.OrderItems.Single();

        item.Product = new Product
        {
            Id = 41,
            PublicId = Guid.NewGuid(),
            Name = "Albrecht 12°",
            Kind = ProductKind.Bottle,
            Type = ProductType.PaleLager,
            PackageSize = 0.5,
            UnitsPerPackage = 20,
            PriceWithVat = livePrice
        };
        item.ProductId = item.Product.Id;

        if (snapshotPrice is not null)
            stop.Items.Add(new OutgoingShipmentStopItem
            {
                PublicId = Guid.NewGuid(),
                OrderItemId = item.Id,
                ProductId = item.Product.Id,
                ProductName = "Albrecht 12°",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                PackageSize = 0.5,
                UnitsPerPackage = 20,
                Quantity = item.Quantity,
                UnitPriceWithVat = snapshotPrice.Value,
                BreweryName = "Pivovar Zittau",
                BreweryPublicId = Guid.NewGuid()
            });

        return shipment;
    }

    private static Product ProductOf(OutgoingShipment shipment) =>
        shipment.Stops.Single().ClientOrder!.OrderItems.Single().Product!;

    private static OutgoingShipmentStopItem StopItemOf(OutgoingShipment shipment) =>
        shipment.Stops.Single().Items.Single();

    #endregion
}
