using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Update;
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
}
