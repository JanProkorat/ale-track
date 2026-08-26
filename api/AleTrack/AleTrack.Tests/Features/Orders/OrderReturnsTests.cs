using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// Returns ("vratky") are owned by the order — planned with it, read-only everywhere else.
/// </summary>
public sealed class OrderReturnsTests
{
    [Fact]
    public async Task ProcessAsync_CreateOrder_PersistsReturns()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());

        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product]);

        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: clientId,
                orderItems: [new CreateOrderItemDto { ProductId = productId, Quantity = 5 }],
                returns:
                [
                    new OrderReturnDto { Name = "Sud 50 l — prázdný", Quantity = 12, Note = "Poškozený ventil" },
                    new OrderReturnDto { Name = "Přepravka", Quantity = 3 }
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var order = client.Orders.Should().ContainSingle().Subject;
        order.Returns.Should().HaveCount(2);
        order.Returns.Should().Contain(r => r.Name == "Sud 50 l — prázdný" && r.Quantity == 12 && r.Note == "Poškozený ventil");
        order.Returns.Should().Contain(r => r.Name == "Přepravka" && r.Quantity == 3 && r.Note == null);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_AddsUpdatesAndDropsReturns()
    {
        var orderId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());

        var keptId = Guid.NewGuid();
        var kept = new OrderReturn { PublicId = keptId, Name = "Sud 50 l", Quantity = 4, Note = "Původní" };
        var dropped = new OrderReturn { PublicId = Guid.NewGuid(), Name = "Přepravka", Quantity = 9 };

        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: client,
            returns: [kept, dropped]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: clientId,
                orderItems: [],
                returns:
                [
                    // existing row, edited in place — keeps its id
                    new OrderReturnDto { Id = keptId, Name = "Sud 30 l", Quantity = 7, Note = "Upravená" },
                    // brand new row
                    new OrderReturnDto { Name = "Láhev 0,5 l", Quantity = 20 }
                    // `dropped` is left out, so it goes away
                ]
            )
        };

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(command, CancellationToken.None);

        order.Returns.Should().HaveCount(2);

        var edited = order.Returns.Should().ContainSingle(r => r.PublicId == keptId).Subject;
        edited.Name.Should().Be("Sud 30 l");
        edited.Quantity.Should().Be(7);
        edited.Note.Should().Be("Upravená");

        order.Returns.Should().Contain(r => r.Name == "Láhev 0,5 l" && r.Quantity == 20);
        order.Returns.Should().NotContain(r => r.Name == "Přepravka");

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_GetOrderDetail_ProjectsReturnsWithNote()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        var returnId = Guid.NewGuid();
        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: client,
            returns: [new OrderReturn { PublicId = returnId, Name = "Sud 50 l", Quantity = 6, Note = "Vrací se v pondělí" }]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var request = new GetOrderDetailRequest { Id = orderId };
        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        var result = endpoint.Response;
        result.Returns.Should().ContainSingle();
        result.Returns[0].Id.Should().Be(returnId);
        result.Returns[0].Name.Should().Be("Sud 50 l");
        result.Returns[0].Quantity.Should().Be(6);
        result.Returns[0].Note.Should().Be("Vrací se v pondělí");
    }

    [Theory]
    [InlineData("", 5)]      // blank name
    [InlineData("Sud", 0)]   // zero quantity
    [InlineData("Sud", -1)]  // negative quantity
    public void OrderReturnValidator_RejectsInvalidRows(string name, int quantity)
    {
        var validator = new OrderReturnDtoValidator();

        validator.Validate(new OrderReturnDto { Name = name, Quantity = quantity }).IsValid.Should().BeFalse();
    }

    [Fact]
    public void OrderReturnValidator_RejectsOverlongNameAndNote()
    {
        var validator = new OrderReturnDtoValidator();

        validator.Validate(new OrderReturnDto { Name = new string('x', 201), Quantity = 1 })
            .Errors.Should().Contain(e => e.PropertyName == nameof(OrderReturnDto.Name));

        validator.Validate(new OrderReturnDto { Name = "Sud", Quantity = 1, Note = new string('x', 501) })
            .Errors.Should().Contain(e => e.PropertyName == nameof(OrderReturnDto.Note));
    }

    [Fact]
    public void OrderReturnValidator_AcceptsValidRow()
    {
        var validator = new OrderReturnDtoValidator();

        validator.Validate(new OrderReturnDto { Name = "Sud 50 l", Quantity = 12, Note = null })
            .IsValid.Should().BeTrue();

        validator.Validate(new OrderReturnDto { Name = "Sud 50 l", Quantity = 12, Note = "Poznámka" })
            .IsValid.Should().BeTrue();
    }
}
