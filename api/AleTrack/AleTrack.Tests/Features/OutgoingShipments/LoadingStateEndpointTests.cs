using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetLoadingState;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Loading is tracked per product and invoice column, so the pieces on one brewery invoice can
/// be dictated and checked independently of the pieces on another.
/// </summary>
public sealed class LoadingStateEndpointTests
{
    #region storing

    [Fact]
    public async Task SetState_StoresItForThatColumnOnly()
    {
        var scenario = Scenario.Build();
        var dbContext = scenario.Mock();

        await Set(scenario, dbContext, sequence: 1, ShipmentLoadingState.Dictated);

        scenario.StateAt(1).Should().Be(ShipmentLoadingState.Dictated);
        scenario.Shipment.LoadingStates.Should().ContainSingle("only the touched column is stored");
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetState_ColumnsAreIndependent()
    {
        var scenario = Scenario.Build();
        scenario.SplitOff(sequence: 2, quantity: 4);

        await Set(scenario, scenario.Mock(), sequence: 2, ShipmentLoadingState.Checked);

        scenario.StateAt(2).Should().Be(ShipmentLoadingState.Checked);
        scenario.StateAt(1).Should().Be(ShipmentLoadingState.NotLoaded, "the remainder was not touched");
    }

    [Fact]
    public async Task SetState_BackToNotLoaded_DropsTheRow()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Dictated);

        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.NotLoaded);

        scenario.Shipment.LoadingStates.Should().BeEmpty("a stored 'nothing done' is the same as no row");
    }

    [Fact]
    public async Task SetState_Existing_IsUpdatedNotDuplicated()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Dictated);

        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Checked);

        scenario.Shipment.LoadingStates.Should().ContainSingle().Which.State.Should().Be(ShipmentLoadingState.Checked);
    }

    #endregion

    #region what a column may hold

    [Fact]
    public async Task SetState_ColumnCarryingNoPieces_IsRejected()
    {
        // F2 exists but holds nothing of this product — there is nothing there to load.
        var scenario = Scenario.Build();
        scenario.AddInvoices(2);

        var act = async () => await Set(scenario, scenario.Mock(), sequence: 2, ShipmentLoadingState.Dictated);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task SetState_RemainderColumnCoversPiecesFromOurOwnGarage()
    {
        // Those are on no brewery invoice at all, but they are in the van and must be loadable.
        var scenario = Scenario.Build();
        scenario.OrderItem.QuantityFromInventory = scenario.OrderItem.Quantity;

        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Dictated);

        scenario.StateAt(1).Should().Be(ShipmentLoadingState.Dictated);
    }

    [Fact]
    public async Task SetState_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build(state: OutgoingShipmentState.Delivered);

        var act = async () => await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Dictated);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task SetState_UnknownProduct_IsNotFound()
    {
        var scenario = Scenario.Build();
        var endpoint = EndpointBuilder<SetLoadingStateRequest, SetLoadingStateEndpoint>.Create(scenario.Mock().Object);

        var act = async () => await endpoint.HandleAsync(new SetLoadingStateRequest
        {
            Id = scenario.ShipmentId,
            Data = new SetLoadingStateDto { ProductId = Guid.NewGuid(), Sequence = 1, State = ShipmentLoadingState.Dictated },
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    #endregion

    #region the derived order-item flag

    [Fact]
    public async Task SetState_UnsplitProduct_ConfirmsTheOrderItem()
    {
        var scenario = Scenario.Build();

        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Dictated);

        scenario.OrderItem.IsShipmentLoadingConfirmed.Should().BeTrue();
    }

    [Fact]
    public async Task SetState_SplitProduct_NeedsEveryColumnBeforeConfirming()
    {
        var scenario = Scenario.Build();
        scenario.SplitOff(sequence: 2, quantity: 4);

        await Set(scenario, scenario.Mock(), sequence: 2, ShipmentLoadingState.Checked);
        scenario.OrderItem.IsShipmentLoadingConfirmed.Should().BeFalse("the remainder is still unloaded");

        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Dictated);
        scenario.OrderItem.IsShipmentLoadingConfirmed.Should().BeTrue();
    }

    [Fact]
    public async Task SetState_ClearingAColumn_TakesTheConfirmationBack()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.Checked);

        await Set(scenario, scenario.Mock(), sequence: 1, ShipmentLoadingState.NotLoaded);

        scenario.OrderItem.IsShipmentLoadingConfirmed.Should().BeFalse();
    }

    #endregion

    #region helpers

    private static async Task Set(Scenario scenario, Mock<AleTrackDbContext> dbContext, int sequence, ShipmentLoadingState state)
    {
        var endpoint = EndpointBuilder<SetLoadingStateRequest, SetLoadingStateEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new SetLoadingStateRequest
        {
            Id = scenario.ShipmentId,
            Data = new SetLoadingStateDto { ProductId = scenario.Product.PublicId, Sequence = sequence, State = state },
        }, CancellationToken.None);
    }

    /// <summary>One client ordering 10 pieces of one product.</summary>
    private sealed class Scenario
    {
        internal required OutgoingShipment Shipment { get; init; }
        internal required Product Product { get; init; }
        internal required OrderItem OrderItem { get; init; }
        internal Guid ShipmentId => Shipment.PublicId;

        internal ShipmentLoadingState StateAt(int sequence) =>
            Shipment.LoadingStates.FirstOrDefault(s => s.Sequence == sequence)?.State ?? ShipmentLoadingState.NotLoaded;

        internal void AddInvoices(int count)
        {
            for (var i = 0; i < count; i++)
                Shipment.PurchaseInvoices.Add(new OutgoingShipmentPurchaseInvoice
                {
                    Id = Shipment.PurchaseInvoices.Count + 1,
                    PublicId = Guid.NewGuid(),
                    OutgoingShipment = Shipment,
                    Sequence = Shipment.PurchaseInvoices.Count + 1,
                });
        }

        /// <summary>Moves pieces onto a later invoice, the way the split endpoint would.</summary>
        internal void SplitOff(int sequence, int quantity)
        {
            AddInvoices(sequence);
            var invoice = Shipment.PurchaseInvoices.Single(i => i.Sequence == sequence);
            invoice.Lines.Add(new OutgoingShipmentPurchaseInvoiceLine
            {
                PublicId = Guid.NewGuid(), PurchaseInvoice = invoice, ProductId = Product.Id, Quantity = quantity,
            });
        }

        internal Mock<AleTrackDbContext> Mock() =>
            AleTrackDbContextMockFactory.CreateMock(
                products: [Product],
                outgoingShipments: [Shipment],
                outgoingShipmentLoadingStates: Shipment.LoadingStates.ToList());

        internal static Scenario Build(OutgoingShipmentState state = OutgoingShipmentState.Created)
        {
            var product = new Product { Id = 50, PublicId = Guid.NewGuid(), Name = "Albrecht 12°" };
            var item = new OrderItem { Id = 11, PublicId = Guid.NewGuid(), Quantity = 10, ProductId = product.Id, Product = product };
            var shipment = new OutgoingShipment { Id = 7, PublicId = Guid.NewGuid(), Name = "Rozvoz", State = state };

            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1,
                OutgoingShipment = shipment,
                ClientOrder = new Order { Id = 101, PublicId = Guid.NewGuid(), ClientId = 1, OrderItems = [item] },
            });

            return new Scenario { Shipment = shipment, Product = product, OrderItem = item };
        }
    }

    #endregion
}
