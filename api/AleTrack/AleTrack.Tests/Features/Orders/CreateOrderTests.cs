using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Orders;

public sealed class CreateOrderTests
{
    [Fact]
    public async Task ProcessAsync_CreateOrder_Success()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var product1Id = Guid.NewGuid();
        var product2Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id, name: "Product 1");
        var product2 = ProductBuilder.BuildEntity(publicId: product2Id, name: "Product 2");

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            products: [product1, product2]
        );

        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: clientId,
                requiredDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
                orderItems:
                [
                    new CreateOrderItemDto
                    {
                        ProductId = product1Id,
                        Quantity = 10,
                        ReminderState = OrderItemReminderState.Added
                    },
                    new CreateOrderItemDto
                    {
                        ProductId = product2Id,
                        Quantity = 20,
                        ReminderState = OrderItemReminderState.Resolved
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        
        // Verify that the order was added to the client
        client.Orders.Should().HaveCount(1);
        var addedOrder = client.Orders.First();
        addedOrder.Client.Should().Be(client);
        addedOrder.State.Should().Be(OrderState.New);
        addedOrder.RequiredDeliveryDate.Should().Be(command.Data.RequiredDeliveryDate);
        addedOrder.OrderItems.Should().HaveCount(2);
        
        addedOrder.OrderItems.Should().Contain(oi => 
            oi.Product == product1 && 
            oi.Quantity == 10 && 
            oi.ReminderState == OrderItemReminderState.Added);
        
        addedOrder.OrderItems.Should().Contain(oi => 
            oi.Product == product2 && 
            oi.Quantity == 20 && 
            oi.ReminderState == OrderItemReminderState.Resolved);
    }

    [Fact]
    public async Task ProcessAsync_CreateOrder_ClientNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: Guid.NewGuid()
            )
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_CreateOrder_ProductNotFound()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client]
        );

        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: clientId,
                orderItems:
                [
                    new CreateOrderItemDto
                    {
                        ProductId = Guid.NewGuid(), // Non-existent product
                        Quantity = 10,
                        ReminderState = OrderItemReminderState.Added
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
