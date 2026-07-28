using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Orders;

public sealed class UpdateOrderTests
{
    [Fact]
    public async Task ProcessAsync_UpdateOrder_Success()
    {
        var orderId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var product1Id = Guid.NewGuid();
        var product2Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id, name: "Product 1");
        var product2 = ProductBuilder.BuildEntity(publicId: product2Id, name: "Product 2");

        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: client,
            state: OrderState.New,
            requiredDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5))
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            products: [product1, product2],
            orders: [order]
        );

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: clientId,
                requiredDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                actualDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow),
                state: OrderState.Finished,
                orderItems:
                [
                    new UpdateOrderItemDto
                    {
                        ProductId = product1Id,
                        Quantity = 15,
                        ReminderState = OrderItemReminderState.Added
                    },
                    new UpdateOrderItemDto
                    {
                        ProductId = product2Id,
                        Quantity = 25,
                        ReminderState = OrderItemReminderState.Resolved
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the order entity was updated with correct values
        order.Client.Should().Be(client);
        order.RequiredDeliveryDate.Should().Be(command.Data.RequiredDeliveryDate);
        order.ActualDeliveryDate.Should().Be(command.Data.ActualDeliveryDate);
        order.State.Should().Be(command.Data.State);
        order.OrderItems.Should().HaveCount(2);

        order.OrderItems.Should().Contain(oi =>
            oi.Product == product1 &&
            oi.Quantity == 15 &&
            oi.ReminderState == OrderItemReminderState.Added);

        order.OrderItems.Should().Contain(oi =>
            oi.Product == product2 &&
            oi.Quantity == 25 &&
            oi.ReminderState == OrderItemReminderState.Resolved);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateOrderRequest
        {
            Id = Guid.NewGuid(),
            Data = OrderBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    // Spec: "Changing an order's client implies changing its address ... so it
    // takes the same path." Kind/placeId are left at Official/null on both
    // sides here, so ApplyAsync alone would report changed = false; the
    // client swap must still drive propagation onto the order's stop.
    [Fact]
    public async Task ProcessAsync_UpdateOrder_ClientChanged_PropagatesEvenWhenAddressKindUnchanged()
    {
        var orderId = Guid.NewGuid();
        var oldClient = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var newClientId = Guid.NewGuid();
        var newClient = ClientBuilder.BuildEntity(
            publicId: newClientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: oldClient,
            state: OrderState.New
        );

        var shipment = new OutgoingShipment { PublicId = Guid.NewGuid(), State = OutgoingShipmentState.Created };
        var stop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            OutgoingShipment = shipment,
            SelectedAddressKind = DeliveryAddressKind.Official,
            IsAddressOverridden = false
        };
        shipment.Stops.Add(stop);
        order.OutgoingShipmentStop = stop;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [oldClient, newClient],
            orders: [order],
            outgoingShipments: [shipment]
        );

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: newClientId,
                deliveryAddressKind: DeliveryAddressKind.Official,
                clientDeliveryPlaceId: null,
                orderItems: []
            )
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        order.Client.Should().Be(newClient);
        stop.AddressChangedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_ClientNotFound()
    {
        var orderId = Guid.NewGuid();
        var oldClientId = Guid.NewGuid();
        var oldClient = ClientBuilder.BuildEntity(
            publicId: oldClientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: oldClient,
            state: OrderState.New
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [oldClient],
            orders: [order]
        );

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: Guid.NewGuid() // Non-existent client
            )
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_ProductNotFound()
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

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order]
        );

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: clientId,
                orderItems:
                [
                    new UpdateOrderItemDto
                    {
                        ProductId = Guid.NewGuid(), // Non-existent product
                        Quantity = 15,
                        ReminderState = OrderItemReminderState.Added
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    // ---------------------------------------------------------------------------------
    // Content freeze.
    //
    // An order's items freeze once it is closed, or once the shipment carrying it has been
    // packed. This endpoint replaces the item rows on every save, and
    // outgoing_shipment_invoice_lines.order_item_id is Cascade — so an unguarded save on a
    // delivered order deleted that order's invoice lines outright.
    // ---------------------------------------------------------------------------------

    private sealed record FreezeFixture(Order Order, Client Client, Product Product, OrderItem Item);

    private static FreezeFixture BuildFreezeFixture(
        OrderState orderState,
        OutgoingShipmentState? shipmentState)
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid());
        product.Id = 41;

        var item = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = product,
            ProductId = product.Id,
            Quantity = 15,
            ReminderState = OrderItemReminderState.Added
        };

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: orderState, orderItems: [item]);

        if (shipmentState is not null)
        {
            order.OutgoingShipmentStop = new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(),
                Kind = OutgoingShipmentStopKind.Order,
                Order = 1,
                OutgoingShipment = OutgoingShipmentBuilder.BuildEntity(state: shipmentState.Value)
            };
        }

        return new FreezeFixture(order, client, product, item);
    }

    /// <summary>
    /// The order's current content, as the order screen re-sends it on every save.
    /// </summary>
    private static UpdateOrderDto EchoDto(FreezeFixture f) => OrderBuilder.BuildUpdateDto(
        clientId: f.Client.PublicId,
        state: f.Order.State,
        actualDeliveryDate: f.Order.ActualDeliveryDate,
        orderItems:
        [
            new UpdateOrderItemDto
            {
                ProductId = f.Product.PublicId,
                Quantity = f.Item.Quantity,
                ReminderState = f.Item.ReminderState
            }
        ]);

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockForFreeze(FreezeFixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.Product],
            orders: [f.Order]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    [Fact]
    public async Task ProcessAsync_UpdateItemsOfFinishedOrder_Fails()
    {
        var f = BuildFreezeFixture(OrderState.Finished, shipmentState: null);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.OrderItems[0].Quantity = 99;

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(db.Object);

        var act = async () => await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.OrderContentFrozen);

        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_UpdateItemsOfOrderOnLoadedShipment_Fails()
    {
        var f = BuildFreezeFixture(OrderState.Planning, OutgoingShipmentState.Loaded);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.OrderItems.Clear();

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(db.Object);

        var act = async () => await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.OrderContentFrozen);

        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_ReopenFinishedOrder_Fails()
    {
        var f = BuildFreezeFixture(OrderState.Finished, OutgoingShipmentState.Delivered);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.State = OrderState.Planning;

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(db.Object);

        var act = async () => await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.OrderContentFrozen);

        f.Order.State.Should().Be(OrderState.Finished);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// Notes and returns are written at and after delivery, so they stay editable — and the
    /// item rows must survive untouched, since recreating them cascades the invoice lines away.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateNotesOfFinishedOrder_SucceedsAndKeepsItemRows()
    {
        var f = BuildFreezeFixture(OrderState.Finished, OutgoingShipmentState.Delivered);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.Notes = [new OrderNoteDto { Text = "Klient si stěžoval na teplotu." }];
        data.RequiredDeliveryDate = new DateOnly(2026, 8, 1);

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(db.Object);

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.Notes.Should().HaveCount(1);
        f.Order.RequiredDeliveryDate.Should().Be(new DateOnly(2026, 8, 1));
        f.Order.OrderItems.Should().ContainSingle()
            .Which.Should().BeSameAs(f.Item, "the row must not be recreated — its invoice lines cascade off it");
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Cancelling a run frees its orders for reuse but the stop link survives, so a freed
    /// order must still be editable.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateItemsOfOrderFreedFromCancelledShipment_Success()
    {
        var f = BuildFreezeFixture(OrderState.New, OutgoingShipmentState.Cancelled);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.State = OrderState.New;
        data.OrderItems[0].Quantity = 7;

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(db.Object);

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.OrderItems.Should().ContainSingle().Which.Quantity.Should().Be(7);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateItemsOfOrderOnCreatedShipment_Success()
    {
        var f = BuildFreezeFixture(OrderState.Planning, OutgoingShipmentState.Created);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.OrderItems[0].Quantity = 3;

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(db.Object);

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.OrderItems.Should().ContainSingle().Which.Quantity.Should().Be(3);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
