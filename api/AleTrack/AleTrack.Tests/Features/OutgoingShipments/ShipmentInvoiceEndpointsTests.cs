using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.AddInvoice;
using AleTrack.Features.OutgoingShipments.Commands.DeleteInvoice;
using AleTrack.Features.OutgoingShipments.Commands.MoveInvoiceLine;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Endpoint-level tests for the invoice split: reading it, moving pieces between invoices
/// (including across clients), and opening or deleting an extra invoice.
/// </summary>
public sealed class ShipmentInvoiceEndpointsTests
{
    #region read

    [Fact]
    public async Task GetInvoices_NeverSplitShipment_ReturnsOneInvoicePerClientWithEverythingOnIt()
    {
        var scenario = Scenario.Build();
        var dbContext = scenario.Mock();

        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        var result = endpoint.Response;
        result.Invoices.Should().HaveCount(2);
        result.IsEditable.Should().BeTrue();
        result.Adjustments.Should().BeEmpty();

        var first = result.Invoices[0];
        first.ClientName.Should().Be("Klient A");
        first.StopOrder.Should().Be(1);
        first.Sequence.Should().Be(1);
        first.Lines.Sum(l => l.Quantity).Should()
            .Be(10, "4 of the 10 come from stock, but sourcing adds no billable pieces");
        first.Lines.Should().Contain(l => l.IsFromStock,
            "the line is flagged so the office can see part of it came from our own stock");
        first.Lines.Should().OnlyContain(l => l.OrderingClientId == first.ClientId, "nothing is cross-billed yet");
        result.Invoices[1].ClientName.Should().Be("Klient B");
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetInvoices_LinesCarryProductDetailAndPrice()
    {
        var scenario = Scenario.Build();
        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(scenario.Mock().Object);

        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        // Client A's line is stock-flagged now that its order item is partly sourced,
        // so take a purely brewery-supplied line instead.
        var line = endpoint.Response.Invoices.SelectMany(i => i.Lines).First(l => !l.IsFromStock);
        line.Name.Should().Be("Albrecht 12°");
        line.Kind.Should().Be(ProductKind.Keg);
        line.PackageSize.Should().Be(30);
        line.PriceWithVat.Should().Be(1290m);
        line.SourceKind.Should().Be(InvoiceLineSourceKind.OrderItem);
        line.SourceItemId.Should().NotBeEmpty("a move request addresses the item by this ID");
    }

    /// <summary>
    /// The billing correctness bug from #25. Correcting the Svijany seed data on 2026-07-28 moved
    /// Svijanský Vozka from 12.09 to 11.49, and every historical invoice containing it changed with
    /// it. Nothing flagged that.
    /// </summary>
    [Fact]
    public async Task GetInvoices_RepricingTheProduct_DoesNotRestateAnIssuedInvoice()
    {
        // The real sequence: the split is drawn up while the run is still being planned, the run
        // is then delivered, and only afterwards is the product repriced.
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.Shipment.State = OutgoingShipmentState.Delivered;
        scenario.Product.PriceWithVat = 99m;
        scenario.Product.Name = "Přejmenováno";

        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(scenario.Mock().Object);
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        var lines = endpoint.Response.Invoices.SelectMany(i => i.Lines)
            .Where(l => l.SourceKind == InvoiceLineSourceKind.OrderItem)
            .ToList();

        lines.Should().NotBeEmpty();
        lines.Should().OnlyContain(l => l.PriceWithVat == 1290m, "the invoice was issued at this price");
        lines.Should().OnlyContain(l => l.Name == "Albrecht 12°");
    }

    /// <summary>
    /// A planned run is a different matter: nothing has been issued, so its split should follow a
    /// price correction rather than quietly bill the old one.
    /// </summary>
    [Fact]
    public async Task GetInvoices_RepricingWhileStillPlanned_DoesFollowTheProduct()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.Product.PriceWithVat = 99m;

        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(scenario.Mock().Object);
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        endpoint.Response.Invoices.SelectMany(i => i.Lines)
            .Where(l => l.SourceKind == InvoiceLineSourceKind.OrderItem)
            .Should().OnlyContain(l => l.PriceWithVat == 99m);
    }

    [Fact]
    public async Task GetInvoices_DeliveredShipment_IsNotEditable()
    {
        var scenario = Scenario.Build(state: OutgoingShipmentState.Delivered);
        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(scenario.Mock().Object);

        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        endpoint.Response.IsEditable.Should().BeFalse();
    }

    [Fact]
    public async Task GetInvoices_ReportsDriftAfterTheOrderQuantityChanged()
    {
        var scenario = Scenario.Build();
        // materialise the split, then change the order underneath it
        scenario.Materialise();
        scenario.OrderItemA.Quantity = 6;

        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(scenario.Mock().Object);
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        endpoint.Response.Adjustments.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Kind = InvoiceAdjustmentKind.QuantityRemoved,
                SourceKind = InvoiceLineSourceKind.OrderItem,
                ItemName = "Albrecht 12°",
                Quantity = 4
            });
    }

    [Fact]
    public async Task GetInvoices_ShipmentNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = Guid.NewGuid() }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    #endregion

    #region move

    [Fact]
    public async Task MoveInvoiceLine_PartialQuantityToAnotherClient_BecomesACrossBilledLine()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var from = scenario.InvoiceOf(Scenario.ClientAId);
        var to = scenario.InvoiceOf(Scenario.ClientBId);

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = from.PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 3,
            ToInvoiceId = to.PublicId
        });

        from.Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should().Be(7);
        to.Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should().Be(3);
    }

    [Fact]
    public async Task MoveInvoiceLine_WholeLine_RemovesItFromTheOrigin()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var from = scenario.InvoiceOf(Scenario.ClientAId);
        var to = scenario.InvoiceOf(Scenario.ClientBId);

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = from.PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 10,
            ToInvoiceId = to.PublicId
        });

        from.Lines.Should().NotContain(l => l.OrderItemId == scenario.OrderItemA.Id);
        to.Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should().Be(10);
    }

    [Fact]
    public async Task MoveInvoiceLine_MoreThanTheSourceHolds_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 999,
            ToInvoiceId = scenario.InvoiceOf(Scenario.ClientBId).PublicId
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        scenario.InvoiceOf(Scenario.ClientAId).Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id)
            .Quantity.Should().Be(10, "a rejected move must not touch the split");
    }

    [Fact]
    public async Task MoveInvoiceLine_CapIsPerSourceNotPerProduct()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var a = scenario.InvoiceOf(Scenario.ClientAId);
        var b = scenario.InvoiceOf(Scenario.ClientBId);

        // Put 3 of A's Albrecht onto B, which already has 5 of its own. B now shows one merged
        // row of 8, from two different sources.
        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = a.PublicId, SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId, Quantity = 3, ToInvoiceId = b.PublicId
        });
        b.Lines.Where(l => l.SourceKind == InvoiceLineSourceKind.OrderItem).Sum(l => l.Quantity).Should().Be(8);

        // Moving 6 must fail: the row totals 8, but the chosen source only contributes 3.
        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = b.PublicId, SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId, Quantity = 6, ToInvoiceId = a.PublicId
        });

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task MoveInvoiceLine_ToNewInvoiceForClient_OpensItWithTheNextSequence()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 4,
            ToClientId = scenario.ClientA.PublicId
        });

        var invoices = scenario.Shipment.Invoices.Where(i => i.ClientId == Scenario.ClientAId).OrderBy(i => i.Sequence).ToList();
        invoices.Should().HaveCount(2);
        invoices[1].Sequence.Should().Be(2);
        invoices[1].Lines.Single().Quantity.Should().Be(4);
    }

    [Fact]
    public async Task MoveInvoiceLine_MergesIntoAnExistingLineForTheSameSource()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var a = scenario.InvoiceOf(Scenario.ClientAId);
        var b = scenario.InvoiceOf(Scenario.ClientBId);

        var dto = new MoveInvoiceLineDto
        {
            FromInvoiceId = a.PublicId, SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId, Quantity = 2, ToInvoiceId = b.PublicId
        };
        await Move(scenario, dto);
        await Move(scenario, dto);

        b.Lines.Where(l => l.OrderItemId == scenario.OrderItemA.Id).Should()
            .ContainSingle("two moves of the same source merge into one line").Which
            .Quantity.Should().Be(4);
    }

    [Fact]
    public async Task MoveInvoiceLine_StockSourcedPieces_AreMovedBySplittingTheOrderItemsLine()
    {
        // Inventory sourcing is no longer its own line kind — the pieces are billed as
        // part of the order item that they fulfil. Billing them to someone else is done
        // by splitting that line, which is what this used to prove for a separate kind.
        var scenario = Scenario.Build();
        scenario.Materialise();

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 2,
            ToInvoiceId = scenario.InvoiceOf(Scenario.ClientBId).PublicId
        });

        scenario.InvoiceOf(Scenario.ClientBId).Lines
            .Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should().Be(2);
    }

    [Fact]
    public async Task MoveInvoiceLine_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build(state: OutgoingShipmentState.Delivered);
        scenario.Materialise();

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 1,
            ToInvoiceId = scenario.InvoiceOf(Scenario.ClientBId).PublicId
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task MoveInvoiceLine_TargetInvoiceFromAnotherShipment_IsNotFound()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 1,
            ToInvoiceId = Guid.NewGuid()
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task MoveInvoiceLine_SameSourceAndTarget_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var a = scenario.InvoiceOf(Scenario.ClientAId);

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = a.PublicId, SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId, Quantity = 1, ToInvoiceId = a.PublicId
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void MoveInvoiceLineValidator_RejectsNonPositiveQuantity(int quantity)
    {
        var validator = new MoveInvoiceLineDtoValidator();

        var result = validator.Validate(new MoveInvoiceLineDto
        {
            FromInvoiceId = Guid.NewGuid(), SourceItemId = Guid.NewGuid(),
            Quantity = quantity, ToInvoiceId = Guid.NewGuid()
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void MoveInvoiceLineValidator_RequiresExactlyOneTarget()
    {
        var validator = new MoveInvoiceLineDtoValidator();
        var baseDto = new MoveInvoiceLineDto { FromInvoiceId = Guid.NewGuid(), SourceItemId = Guid.NewGuid(), Quantity = 1 };

        validator.Validate(baseDto).IsValid.Should().BeFalse("no target given");
        validator.Validate(baseDto with { ToInvoiceId = Guid.NewGuid(), ToClientId = Guid.NewGuid() })
            .IsValid.Should().BeFalse("two targets given");
        validator.Validate(baseDto with { ToInvoiceId = Guid.NewGuid(), ToPrivate = true })
            .IsValid.Should().BeFalse("an invoice and no invoice at once");
        validator.Validate(baseDto with { ToInvoiceId = Guid.NewGuid() }).IsValid.Should().BeTrue();
        validator.Validate(baseDto with { ToClientId = Guid.NewGuid() }).IsValid.Should().BeTrue();
        validator.Validate(baseDto with { ToPrivate = true }).IsValid.Should().BeTrue();
    }

    [Fact]
    public void MoveInvoiceLineValidator_AcceptsNoOriginInvoice_MeaningTheseArePrivatePieces()
    {
        var validator = new MoveInvoiceLineDtoValidator();

        var result = validator.Validate(new MoveInvoiceLineDto
        {
            FromInvoiceId = null, SourceItemId = Guid.NewGuid(), Quantity = 2, ToInvoiceId = Guid.NewGuid()
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void MoveInvoiceLineValidator_RejectsAnExplicitlyEmptyOriginInvoice()
    {
        var validator = new MoveInvoiceLineDtoValidator();

        var result = validator.Validate(new MoveInvoiceLineDto
        {
            FromInvoiceId = Guid.Empty, SourceItemId = Guid.NewGuid(), Quantity = 2, ToInvoiceId = Guid.NewGuid()
        });

        result.IsValid.Should().BeFalse("null is how a caller says 'private', an empty Guid is a mistake");
    }

    #endregion

    #region private pieces

    [Fact]
    public async Task MoveInvoiceLine_ToPrivate_TakesThePiecesOffTheInvoice()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var from = scenario.InvoiceOf(Scenario.ClientAId);

        var lines = await MoveTracked(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = from.PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 4,
            ToPrivate = true
        });

        from.Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should()
            .Be(6, "the rest stays billed");
        lines.Verify(s => s.Add(It.Is<OutgoingShipmentInvoiceLine>(l =>
                l.IsPrivate && l.InvoiceId == null && l.Quantity == 4 && l.OrderItemId == scenario.OrderItemA.Id)),
            Times.Once, "the excluded pieces are stored as a line with no invoice");
    }

    [Fact]
    public async Task MoveInvoiceLine_WholeLineToPrivate_LeavesTheClientAnEmptyInvoice()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var from = scenario.InvoiceOf(Scenario.ClientAId);

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = from.PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 10,
            ToPrivate = true
        });

        from.Lines.Should().BeEmpty("it is where un-marking would return the pieces to");
        scenario.Shipment.Invoices.Should().Contain(from);
    }

    [Fact]
    public async Task MoveInvoiceLine_OutOfPrivate_BillsThePiecesAgain()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.MarkPrivate(scenario.OrderItemA, quantity: 4);
        var invoice = scenario.InvoiceOf(Scenario.ClientAId);

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = null,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 3,
            ToInvoiceId = invoice.PublicId
        });

        invoice.Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should().Be(9);
        scenario.PrivateLines.Single().Quantity.Should().Be(1);
    }

    [Fact]
    public async Task MoveInvoiceLine_OutOfPrivateToAnotherClient_IsAllowed()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var privateLine = scenario.MarkPrivate(scenario.OrderItemA, quantity: 4);
        var other = scenario.InvoiceOf(Scenario.ClientBId);

        var lines = await MoveTracked(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = null,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 4,
            ToInvoiceId = other.PublicId
        });

        other.Lines.Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should()
            .Be(4, "the pieces become cross-billed, which the UI marks as such");
        privateLine.Quantity.Should().Be(0);
        lines.Verify(s => s.Remove(privateLine), Times.Once, "an emptied private line is deleted, not left at zero");
    }

    [Fact]
    public async Task MoveInvoiceLine_MoreThanIsPrivate_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.MarkPrivate(scenario.OrderItemA, quantity: 4);

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = null,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 5,
            ToInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        scenario.PrivateLines.Single().Quantity.Should().Be(4, "a rejected move must not touch the split");
    }

    [Fact]
    public async Task MoveInvoiceLine_ItemWithNoPrivatePieces_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = null,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 1,
            ToInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task MoveInvoiceLine_PrivateToPrivate_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.MarkPrivate(scenario.OrderItemA, quantity: 4);

        var act = () => Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = null,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 2,
            ToPrivate = true
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task GetInvoices_PrivatePieces_AreReportedSeparatelyFromTheInvoices()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.MarkPrivate(scenario.OrderItemA, quantity: 4);

        var result = await GetInvoices(scenario);

        result.Invoices.Single(i => i.ClientId == scenario.ClientA.PublicId).Lines.Sum(l => l.Quantity).Should()
            .Be(6, "private pieces are not billed");
        var privateLine = result.PrivateLines.Should().ContainSingle().Subject;
        privateLine.Quantity.Should().Be(4);
        privateLine.Name.Should().Be("Albrecht 12°");
        privateLine.OrderingClientId.Should().Be(scenario.ClientA.PublicId,
            "the UI files them under the client who ordered them");
        result.Adjustments.Should().BeEmpty("keeping pieces off an invoice is not drift");
    }

    [Fact]
    public async Task GetInvoices_PrivatePiecesOfARemovedItem_AreDroppedAndReported()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        scenario.MarkPrivate(scenario.OrderItemA, quantity: 4);

        var order = scenario.Shipment.Stops.Single(s => s.ClientOrder?.ClientId == Scenario.ClientAId).ClientOrder!;
        order.OrderItems.Remove(scenario.OrderItemA);
        var result = await GetInvoices(scenario);

        result.PrivateLines.Should().BeEmpty();
        result.Adjustments.Should().Contain(a => a.Kind == InvoiceAdjustmentKind.SourceRemoved && a.Quantity == 4);
    }

    #endregion

    #region add / delete

    [Fact]
    public async Task AddInvoice_ForAClientOnTheShipment_OpensAnEmptyOne()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var dbContext = scenario.Mock();

        var endpoint = EndpointBuilder<AddShipmentInvoiceRequest, AddShipmentInvoiceEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new AddShipmentInvoiceRequest
        {
            Id = scenario.ShipmentId,
            Data = new AddShipmentInvoiceDto { ClientId = scenario.ClientA.PublicId }
        }, CancellationToken.None);

        var added = scenario.Shipment.Invoices.Single(i => i.ClientId == Scenario.ClientAId && i.Sequence == 2);
        added.Lines.Should().BeEmpty();
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddInvoice_ForAClientNotOnTheShipment_IsNotFound()
    {
        var scenario = Scenario.Build();
        var endpoint = EndpointBuilder<AddShipmentInvoiceRequest, AddShipmentInvoiceEndpoint>.Create(scenario.Mock().Object);

        var act = async () => await endpoint.HandleAsync(new AddShipmentInvoiceRequest
        {
            Id = scenario.ShipmentId,
            Data = new AddShipmentInvoiceDto { ClientId = Guid.NewGuid() }
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task DeleteInvoice_HoldingPieces_ReturnsThemToTheOrderingClient()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        // give A a second invoice holding 4 pieces
        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.OrderItem,
            SourceItemId = scenario.OrderItemA.PublicId,
            Quantity = 4,
            ToClientId = scenario.ClientA.PublicId
        });
        var extra = scenario.Shipment.Invoices.Single(i => i.ClientId == Scenario.ClientAId && i.Sequence == 2);

        var dbContext = scenario.Mock();
        var endpoint = EndpointBuilder<DeleteShipmentInvoiceRequest, DeleteShipmentInvoiceEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteShipmentInvoiceRequest
        {
            Id = scenario.ShipmentId, InvoiceId = extra.PublicId
        }, CancellationToken.None);

        scenario.Shipment.Invoices.Should().NotContain(extra);
        scenario.InvoiceOf(Scenario.ClientAId).Lines
            .Single(l => l.OrderItemId == scenario.OrderItemA.Id).Quantity.Should()
            .Be(10, "reconciliation brings the pieces home, no unwind logic needed");
    }

    [Fact]
    public async Task DeleteInvoice_FirstInvoiceOfAClient_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Materialise();
        var first = scenario.InvoiceOf(Scenario.ClientAId);

        var endpoint = EndpointBuilder<DeleteShipmentInvoiceRequest, DeleteShipmentInvoiceEndpoint>.Create(scenario.Mock().Object);
        var act = async () => await endpoint.HandleAsync(new DeleteShipmentInvoiceRequest
        {
            Id = scenario.ShipmentId, InvoiceId = first.PublicId
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        scenario.Shipment.Invoices.Should().Contain(first);
    }

    [Fact]
    public async Task DeleteInvoice_NotFound()
    {
        var scenario = Scenario.Build();
        var endpoint = EndpointBuilder<DeleteShipmentInvoiceRequest, DeleteShipmentInvoiceEndpoint>.Create(scenario.Mock().Object);

        var act = async () => await endpoint.HandleAsync(new DeleteShipmentInvoiceRequest
        {
            Id = scenario.ShipmentId, InvoiceId = Guid.NewGuid()
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    #endregion

    #region helpers

    private static async Task Move(Scenario scenario, MoveInvoiceLineDto data) =>
        await MoveTracked(scenario, data);

    /// <summary>
    /// Moves pieces and hands back the mocked context, so a test can check what the endpoint asked
    /// to be persisted. Private lines hang off no navigation, so adding and deleting them is an
    /// explicit call on the set rather than something visible in the entity graph.
    /// </summary>
    private static async Task<Mock<DbSet<OutgoingShipmentInvoiceLine>>> MoveTracked(Scenario scenario, MoveInvoiceLineDto data)
    {
        var dbContext = scenario.Mock();
        var endpoint = EndpointBuilder<MoveInvoiceLineRequest, MoveInvoiceLineEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new MoveInvoiceLineRequest { Id = scenario.ShipmentId, Data = data }, CancellationToken.None);
        return Mock.Get(dbContext.Object.OutgoingShipmentInvoiceLines);
    }

    private static async Task<ShipmentInvoicesDto> GetInvoices(Scenario scenario)
    {
        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>
            .Create(scenario.Mock().Object);
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);
        return endpoint.Response;
    }

    /// <summary>
    /// A two-stop shipment: client A orders 10 kegs and gets 4 more from our stock, client B
    /// orders 5 of the same product. Enough to exercise cross-client moves and merged rows.
    /// </summary>
    private sealed class Scenario
    {
        internal const long ClientAId = 1;
        internal const long ClientBId = 2;

        internal required OutgoingShipment Shipment { get; init; }
        internal required Client ClientA { get; init; }
        internal required Client ClientB { get; init; }
        internal required OrderItem OrderItemA { get; init; }

        /// <summary>The product every order line in the scenario is of.</summary>
        internal required Product Product { get; init; }
        internal Guid ShipmentId => Shipment.PublicId;

        /// <summary>
        /// Lines the shipment carries that belong to no invoice — the private ones. Kept here
        /// rather than on the shipment because the entity has no navigation for them.
        /// </summary>
        internal List<OutgoingShipmentInvoiceLine> PrivateLines { get; } = [];

        internal OutgoingShipmentInvoice InvoiceOf(long clientId) =>
            Shipment.Invoices.Single(i => i.ClientId == clientId && i.Sequence == 1);

        /// <summary>
        /// Materialises the default split, the way a first read of the shipment would.
        /// </summary>
        internal ReconcileResult Materialise() => ShipmentInvoiceReconciler.Reconcile(Split());

        internal ShipmentInvoiceSplit Split() =>
            new() { Shipment = Shipment, PrivateLines = PrivateLines };

        /// <summary>
        /// Marks pieces of an item private without going through the endpoint, so tests can start
        /// from a shipment that already has some.
        /// </summary>
        internal OutgoingShipmentInvoiceLine MarkPrivate(OrderItem item, int quantity)
        {
            var invoice = Shipment.Invoices.Single(i =>
                i.Lines.Any(l => l.OrderItemId == item.Id));
            var line = invoice.Lines.Single(l => l.OrderItemId == item.Id);
            line.Quantity -= quantity;

            var privateLine = new OutgoingShipmentInvoiceLine
            {
                PublicId = Guid.NewGuid(),
                OutgoingShipmentId = Shipment.Id,
                IsPrivate = true,
                SourceKind = InvoiceLineSourceKind.OrderItem,
                OrderItemId = item.Id,
                Quantity = quantity
            };
            PrivateLines.Add(privateLine);
            return privateLine;
        }

        /// <summary>
        /// The invoice-line rows the last <see cref="Mock"/> was built over. Lines the endpoint
        /// adds land here, which is how a newly created private line becomes observable.
        /// </summary>
        internal List<OutgoingShipmentInvoiceLine> Rows { get; private set; } = [];

        internal Mock<AleTrackDbContext> Mock()
        {
            Rows = Shipment.Invoices.SelectMany(i => i.Lines).Concat(PrivateLines).ToList();

            return AleTrackDbContextMockFactory.CreateMock(
                outgoingShipments: [Shipment],
                outgoingShipmentInvoices: Shipment.Invoices.ToList(),
                outgoingShipmentInvoiceLines: Rows);
        }

        internal static Scenario Build(OutgoingShipmentState state = OutgoingShipmentState.Created)
        {
            var product = new Product
            {
                Id = 50, PublicId = Guid.NewGuid(), Name = "Albrecht 12°",
                Kind = ProductKind.Keg, PackageSize = 30, PriceWithVat = 1290m
            };
            var clientA = new Client { Id = ClientAId, PublicId = Guid.NewGuid(), Name = "Klient A" };
            var clientB = new Client { Id = ClientBId, PublicId = Guid.NewGuid(), Name = "Klient B" };

            var itemA = new OrderItem { Id = 11, PublicId = Guid.NewGuid(), Quantity = 10, ProductId = product.Id, Product = product };
            var itemB = new OrderItem { Id = 12, PublicId = Guid.NewGuid(), Quantity = 5, ProductId = product.Id, Product = product };

            var shipment = new OutgoingShipment
            {
                PublicId = Guid.NewGuid(), Name = "Rozvoz", State = state
            };

            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1,
                OutgoingShipment = shipment,
                ClientOrder = new Order
                {
                    Id = 101, PublicId = Guid.NewGuid(), ClientId = ClientAId, Client = clientA,
                    OrderItems = [itemA]
                }
            });
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 2,
                OutgoingShipment = shipment,
                ClientOrder = new Order
                {
                    Id = 102, PublicId = Guid.NewGuid(), ClientId = ClientBId, Client = clientB,
                    OrderItems = [itemB]
                }
            });

            // Part of client A's ordered pieces come out of our own stock. This changes
            // nothing about what is billed — only where the goods came from.
            itemA.QuantityFromInventory = 4;
            itemA.InventoryItem = new InventoryItem { Id = 31, PublicId = Guid.NewGuid(), Product = product };
            itemA.InventoryItemId = 31;

            return new Scenario
            {
                Shipment = shipment, ClientA = clientA, ClientB = clientB,
                OrderItemA = itemA, Product = product
            };
        }
    }

    #endregion
}
