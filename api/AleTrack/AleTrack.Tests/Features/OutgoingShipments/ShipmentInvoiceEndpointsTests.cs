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
        first.Lines.Sum(l => l.Quantity).Should().Be(14, "10 ordered + 4 from stock");
        first.Lines.Should().Contain(l => l.IsFromStock && l.Quantity == 4);
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

        var line = endpoint.Response.Invoices[0].Lines.First(l => !l.IsFromStock);
        line.Name.Should().Be("Albrecht 12°");
        line.Kind.Should().Be(ProductKind.Keg);
        line.PackageSize.Should().Be(30);
        line.PriceWithVat.Should().Be(1290m);
        line.SourceKind.Should().Be(InvoiceLineSourceKind.OrderItem);
        line.SourceItemId.Should().NotBeEmpty("a move request addresses the item by this ID");
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);

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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);

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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
    public async Task MoveInvoiceLine_ClientExtraItem_CanBeMovedToo()
    {
        var scenario = Scenario.Build();
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);

        await Move(scenario, new MoveInvoiceLineDto
        {
            FromInvoiceId = scenario.InvoiceOf(Scenario.ClientAId).PublicId,
            SourceKind = InvoiceLineSourceKind.ClientExtraItem,
            SourceItemId = scenario.StockExtra.PublicId,
            Quantity = 4,
            ToInvoiceId = scenario.InvoiceOf(Scenario.ClientBId).PublicId
        });

        scenario.InvoiceOf(Scenario.ClientBId).Lines
            .Single(l => l.ClientExtraItemId == scenario.StockExtra.Id).Quantity.Should().Be(4);
    }

    [Fact]
    public async Task MoveInvoiceLine_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build(state: OutgoingShipmentState.Delivered);
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);

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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);

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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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

        validator.Validate(baseDto).IsValid.Should().BeFalse("neither target given");
        validator.Validate(baseDto with { ToInvoiceId = Guid.NewGuid(), ToClientId = Guid.NewGuid() })
            .IsValid.Should().BeFalse("both targets given");
        validator.Validate(baseDto with { ToInvoiceId = Guid.NewGuid() }).IsValid.Should().BeTrue();
        validator.Validate(baseDto with { ToClientId = Guid.NewGuid() }).IsValid.Should().BeTrue();
    }

    #endregion

    #region add / delete

    [Fact]
    public async Task AddInvoice_ForAClientOnTheShipment_OpensAnEmptyOne()
    {
        var scenario = Scenario.Build();
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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
        ShipmentInvoiceReconciler.Reconcile(scenario.Shipment);
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

    private static async Task Move(Scenario scenario, MoveInvoiceLineDto data)
    {
        var endpoint = EndpointBuilder<MoveInvoiceLineRequest, MoveInvoiceLineEndpoint>.Create(scenario.Mock().Object);
        await endpoint.HandleAsync(new MoveInvoiceLineRequest { Id = scenario.ShipmentId, Data = data }, CancellationToken.None);
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
        internal required OutgoingShipmentClientExtraItem StockExtra { get; init; }
        internal Guid ShipmentId => Shipment.PublicId;

        internal OutgoingShipmentInvoice InvoiceOf(long clientId) =>
            Shipment.Invoices.Single(i => i.ClientId == clientId && i.Sequence == 1);

        internal Mock<AleTrackDbContext> Mock() =>
            AleTrackDbContextMockFactory.CreateMock(
                outgoingShipments: [Shipment],
                outgoingShipmentInvoices: Shipment.Invoices.ToList(),
                outgoingShipmentInvoiceLines: Shipment.Invoices.SelectMany(i => i.Lines).ToList());

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

            var stockExtra = new OutgoingShipmentClientExtraItem
            {
                Id = 21, PublicId = Guid.NewGuid(), Quantity = 4,
                ClientId = ClientAId, Client = clientA,
                OutgoingShipment = shipment,
                InventoryItem = new InventoryItem { Id = 31, PublicId = Guid.NewGuid(), Product = product }
            };
            shipment.ClientExtraItems.Add(stockExtra);

            return new Scenario
            {
                Shipment = shipment, ClientA = clientA, ClientB = clientB,
                OrderItemA = itemA, StockExtra = stockExtra
            };
        }
    }

    #endregion
}
