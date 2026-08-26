using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Orders;

public sealed class DeleteOrderTests
{
    [Fact]
    public async Task ProcessAsync_DeleteOrder_Success()
    {
        var orderId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: client,
            state: OrderState.New
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        var command = new DeleteOrderRequest
        {
            Id = orderId
        };

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Orders.Remove(It.IsAny<Order>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_DeleteOrder_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteOrderRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    /// <summary>
    /// A filed run does not lose an order. Cancelling would take a delivery out of a run whose
    /// invoicing has already gone out, and — through the release the endpoint does first — reopen
    /// every debt the order had promised to settle.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_OrderOnAFiledRun_Fails()
    {
        var f = OnRun(filedAt: new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc));
        var dbContext = AleTrackDbContextMockFactory.CreateMock(orders: [f.Order], outgoingShipments: [f.Shipment]);

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(new DeleteOrderRequest { Id = f.Order.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentInvoicingFiled);
        dbContext.Verify(e => e.Orders.Remove(It.IsAny<Order>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_OrderOnAnUnfiledRun_Succeeds()
    {
        var f = OnRun(filedAt: null);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(orders: [f.Order], outgoingShipments: [f.Shipment]);

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteOrderRequest { Id = f.Order.PublicId }, CancellationToken.None);

        dbContext.Verify(e => e.Orders.Remove(It.IsAny<Order>()), Times.Once);
    }

    /// <summary>
    /// A cancelled run frees its orders for reuse, so paperwork filed on it holds nothing — the
    /// same precedence OrderMutability gives it.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_OrderOnAFiledButCancelledRun_Succeeds()
    {
        var f = OnRun(
            filedAt: new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Cancelled);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(orders: [f.Order], outgoingShipments: [f.Shipment]);

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteOrderRequest { Id = f.Order.PublicId }, CancellationToken.None);

        dbContext.Verify(e => e.Orders.Remove(It.IsAny<Order>()), Times.Once);
    }

    /// <summary>One order on one run, with the run's invoicing filed or not.</summary>
    private static (Order Order, OutgoingShipment Shipment) OnRun(
        DateTime? filedAt,
        OutgoingShipmentState state = OutgoingShipmentState.Loaded)
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            state: state,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        shipment.InvoicingFiledAt = filedAt;

        // Both ends of the link: the mocked context does no navigation fixup.
        var stop = shipment.Stops.First();
        stop.OutgoingShipment = shipment;
        order.OutgoingShipmentStop = stop;

        return (order, shipment);
    }
}
