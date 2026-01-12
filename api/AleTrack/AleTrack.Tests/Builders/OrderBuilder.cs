using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class OrderBuilder
{
    public static Order BuildEntity(
        Guid? publicId = null,
        Client? client = null,
        OrderState state = OrderState.New,
        DateTime? createdDate = null,
        DateOnly? requiredDeliveryDate = null,
        DateOnly? actualDeliveryDate = null,
        List<OrderItem>? orderItems = null)
    {
        return new Order
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Client = client ?? ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity()),
            State = state,
            CreatedDate = createdDate ?? DateTime.UtcNow,
            RequiredDeliveryDate = requiredDeliveryDate,
            ActualDeliveryDate = actualDeliveryDate,
            OrderItems = orderItems ?? []
        };
    }

    public static CreateOrderDto BuildCreateDto(
        Guid? clientId = null,
        DateOnly? requiredDeliveryDate = null,
        List<CreateOrderItemDto>? orderItems = null)
    {
        return new CreateOrderDto
        {
            ClientId = clientId ?? Guid.NewGuid(),
            RequiredDeliveryDate = requiredDeliveryDate,
            OrderItems = orderItems ??
            [
                new CreateOrderItemDto
                {
                    ProductId = Guid.NewGuid(),
                    Quantity = 10,
                    ReminderState = OrderItemReminderState.Added
                }
            ]
        };
    }

    public static UpdateOrderDto BuildUpdateDto(
        Guid? clientId = null,
        DateOnly? requiredDeliveryDate = null,
        DateOnly? actualDeliveryDate = null,
        OrderState state = OrderState.Planning,
        List<UpdateOrderItemDto>? orderItems = null)
    {
        return new UpdateOrderDto
        {
            ClientId = clientId ?? Guid.NewGuid(),
            RequiredDeliveryDate = requiredDeliveryDate,
            ActualDeliveryDate = actualDeliveryDate,
            State = state,
            OrderItems = orderItems ??
            [
                new UpdateOrderItemDto
                {
                    ProductId = Guid.NewGuid(),
                    Quantity = 15,
                    ReminderState = OrderItemReminderState.Added
                }
            ]
        };
    }
}
