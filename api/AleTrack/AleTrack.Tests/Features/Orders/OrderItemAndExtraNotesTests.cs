using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// A per-line note on an order item and on a custom extra. Both instruct whoever loads or
/// delivers the line, so — unlike the quantity — they are not frozen content and stay
/// editable at every order and shipment state.
/// </summary>
public sealed class OrderItemAndExtraNotesTests
{
    [Fact]
    public async Task HandleAsync_CreateOrder_PersistsItemAndExtraNotes()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());

        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product]);

        var data = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems:
            [
                new CreateOrderItemDto { ProductId = productId, Quantity = 12, Note = "Nechat u zadního vchodu" }
            ]);
        data.CustomExtraItems =
        [
            new OrderCustomExtraItemDto { Description = "Tácky", Quantity = 50, Note = "S logem, ne generické" },
            new OrderCustomExtraItemDto { Description = "Sklo", Quantity = 6 }
        ];

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new CreateOrderRequest { Data = data }, CancellationToken.None);

        var order = client.Orders.Should().ContainSingle().Subject;
        order.OrderItems.Should().ContainSingle().Which.Note.Should().Be("Nechat u zadního vchodu");
        order.CustomExtraItems.Should().HaveCount(2);
        order.CustomExtraItems.Should().Contain(e => e.Description == "Tácky" && e.Note == "S logem, ne generické");
        order.CustomExtraItems.Should().Contain(e => e.Description == "Sklo" && e.Note == null);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_UpdateEditableOrder_AppliesItemNoteAlongsideQuantityChange()
    {
        var fixture = BuildFixture(OrderState.Planning, shipmentState: null, itemNote: null);
        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.OrderItems[0].Quantity = 20;
        data.OrderItems[0].Note = "Vyložit jako první";

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        var item = fixture.Order.OrderItems.Should().ContainSingle().Subject;
        item.Quantity.Should().Be(20);
        item.Note.Should().Be("Vyložit jako první");
    }

    /// <summary>
    /// The reason the note is written by its own merge step rather than by the item rebuild:
    /// a note-only save reports no change to frozen content, so the rebuild is skipped
    /// entirely — and it has to be, because recreating the row cascades its invoice lines
    /// away. The note must still land.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ItemNoteOnlySaveOfFrozenOrder_SucceedsAndKeepsItemRow()
    {
        var fixture = BuildFixture(OrderState.Finished, OutgoingShipmentState.Delivered, itemNote: null);
        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.OrderItems[0].Note = "Klient si stěžoval na teplotu";

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        fixture.Order.OrderItems.Should().ContainSingle()
            .Which.Should().BeSameAs(fixture.Item, "the row must not be recreated — its invoice lines cascade off it");
        fixture.Item.Note.Should().Be("Klient si stěžoval na teplotu");
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// The same save on a loaded shipment: quantities are frozen, the note is not.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ItemNoteOnLoadedShipment_SucceedsWithoutTouchingQuantity()
    {
        var fixture = BuildFixture(OrderState.Planning, OutgoingShipmentState.Loaded, itemNote: null);
        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.OrderItems[0].Note = "Vyložit u rampy";

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        fixture.Item.Note.Should().Be("Vyložit u rampy");
        fixture.Item.Quantity.Should().Be(15);
    }

    /// <summary>
    /// Clearing a note is the interesting half of the merge path: a null has to overwrite the
    /// stored value rather than be read as "leave it alone". Asserted on a frozen order, where
    /// the surviving row is the one that must change.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ItemNoteClearedOnFrozenOrder_RemovesTheNote()
    {
        var fixture = BuildFixture(OrderState.Finished, OutgoingShipmentState.Delivered, itemNote: "Původní");
        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.OrderItems[0].Note = null;

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        fixture.Order.OrderItems.Should().ContainSingle().Which.Should().BeSameAs(fixture.Item);
        fixture.Item.Note.Should().BeNull();
    }

    /// <summary>
    /// The same on an editable order, where the rebuild replaces the row: the note has to be
    /// re-applied to the *new* row, not left behind on the discarded one.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ItemNoteClearedOnEditableOrder_RemovesTheNote()
    {
        var fixture = BuildFixture(OrderState.Planning, shipmentState: null, itemNote: "Původní");
        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.OrderItems[0].Note = null;

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        fixture.Order.OrderItems.Should().ContainSingle().Which.Note.Should().BeNull();
    }

    /// <summary>
    /// A posted line for a product the order does not carry is ignored — adding and removing
    /// items belongs to the rebuild, not to the note step.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ItemNoteForUnknownProductOnFrozenOrder_LeavesTheOrderAlone()
    {
        var fixture = BuildFixture(OrderState.Finished, OutgoingShipmentState.Delivered, itemNote: "Původní");
        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.OrderItems[0].ProductId = Guid.NewGuid();

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        // Swapping the product *is* a content change, so the freeze rejects the save outright.
        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.OrderContentFrozen);

        fixture.Item.Note.Should().Be("Původní");
    }

    [Fact]
    public async Task HandleAsync_UpdateOrder_EditsAndClearsExtraNote()
    {
        var fixture = BuildFixture(OrderState.Planning, shipmentState: null, itemNote: null);

        var editedId = Guid.NewGuid();
        var clearedId = Guid.NewGuid();
        fixture.Order.CustomExtraItems =
        [
            new OrderCustomExtraItem { PublicId = editedId, Description = "Tácky", Quantity = 50, Note = "Původní" },
            new OrderCustomExtraItem { PublicId = clearedId, Description = "Sklo", Quantity = 6, Note = "Ke smazání" }
        ];

        var dbContext = MockFor(fixture);

        var data = EchoDto(fixture);
        data.CustomExtraItems =
        [
            new OrderCustomExtraItemDto { Id = editedId, Description = "Tácky", Quantity = 80, Note = "Upravená" },
            new OrderCustomExtraItemDto { Id = clearedId, Description = "Sklo", Quantity = 6, Note = null },
            new OrderCustomExtraItemDto { Description = "Otvírák", Quantity = 2, Note = "Nový" }
        ];

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = fixture.Order.PublicId, Data = data }, CancellationToken.None);

        fixture.Order.CustomExtraItems.Should().HaveCount(3);

        var edited = fixture.Order.CustomExtraItems.Should().ContainSingle(e => e.PublicId == editedId).Subject;
        edited.Quantity.Should().Be(80);
        edited.Note.Should().Be("Upravená");

        fixture.Order.CustomExtraItems.Should().ContainSingle(e => e.PublicId == clearedId)
            .Which.Note.Should().BeNull();
        fixture.Order.CustomExtraItems.Should().Contain(e => e.Description == "Otvírák" && e.Note == "Nový");
    }

    [Fact]
    public async Task HandleAsync_GetOrderDetail_ProjectsItemAndExtraNotes()
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid());
        product.Brewery = BreweryBuilder.BuildEntity();

        var itemId = Guid.NewGuid();
        var extraId = Guid.NewGuid();

        var item = new OrderItem { PublicId = itemId, Product = product, Quantity = 12, Note = "Nechat u zadního vchodu" };

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, orderItems: [item]);
        // The projection reads i.Order.PublicId, so the back-reference has to be there.
        item.Order = order;
        order.CustomExtraItems =
        [
            new OrderCustomExtraItem { PublicId = extraId, Description = "Tácky", Quantity = 50, Note = "S logem" }
        ];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = order.PublicId }, CancellationToken.None);

        var result = endpoint.Response;
        result.OrderItems.Should().ContainSingle();
        result.OrderItems[0].Id.Should().Be(itemId);
        result.OrderItems[0].Note.Should().Be("Nechat u zadního vchodu");

        result.CustomExtraItems.Should().ContainSingle();
        result.CustomExtraItems[0].Id.Should().Be(extraId);
        result.CustomExtraItems[0].Note.Should().Be("S logem");
    }

    [Fact]
    public void ExtraItemValidator_RejectsOverlongNote()
    {
        var validator = new OrderCustomExtraItemDtoValidator();

        validator.Validate(new OrderCustomExtraItemDto { Description = "Tácky", Quantity = 1, Note = new string('x', 501) })
            .Errors.Should().Contain(e => e.PropertyName == nameof(OrderCustomExtraItemDto.Note));

        validator.Validate(new OrderCustomExtraItemDto { Description = "Tácky", Quantity = 1, Note = new string('x', 500) })
            .IsValid.Should().BeTrue();

        validator.Validate(new OrderCustomExtraItemDto { Description = "Tácky", Quantity = 1, Note = null })
            .IsValid.Should().BeTrue();
    }

    [Fact]
    public void CreateItemValidator_RejectsOverlongNote()
    {
        var validator = new CreateOrderItemDtoValidator();

        validator.Validate(new CreateOrderItemDto { ProductId = Guid.NewGuid(), Quantity = 1, Note = new string('x', 501) })
            .Errors.Should().Contain(e => e.PropertyName == nameof(CreateOrderItemDto.Note));

        validator.Validate(new CreateOrderItemDto { ProductId = Guid.NewGuid(), Quantity = 1, Note = new string('x', 500) })
            .IsValid.Should().BeTrue();
    }

    [Fact]
    public void UpdateItemValidator_RejectsOverlongNote()
    {
        var validator = new UpdateOrderItemDtoValidator();

        validator.Validate(new UpdateOrderItemDto { ProductId = Guid.NewGuid(), Quantity = 1, Note = new string('x', 501) })
            .Errors.Should().Contain(e => e.PropertyName == nameof(UpdateOrderItemDto.Note));

        validator.Validate(new UpdateOrderItemDto { ProductId = Guid.NewGuid(), Quantity = 1, Note = new string('x', 500) })
            .IsValid.Should().BeTrue();
    }

    private sealed record Fixture(Order Order, Client Client, Product Product, OrderItem Item);

    private static Fixture BuildFixture(
        OrderState orderState,
        OutgoingShipmentState? shipmentState,
        string? itemNote)
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
            ReminderState = OrderItemReminderState.Added,
            Note = itemNote
        };

        var order = OrderBuilder.BuildEntity(
            publicId: Guid.NewGuid(), client: client, state: orderState, orderItems: [item]);

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

        return new Fixture(order, client, product, item);
    }

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockFor(Fixture fixture)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client],
            products: [fixture.Product],
            orders: [fixture.Order]);
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return dbContext;
    }

    /// <summary>
    /// The order's current content, as the order screen re-sends it on every save.
    /// </summary>
    private static UpdateOrderDto EchoDto(Fixture fixture) => OrderBuilder.BuildUpdateDto(
        clientId: fixture.Client.PublicId,
        state: fixture.Order.State,
        actualDeliveryDate: fixture.Order.ActualDeliveryDate,
        orderItems:
        [
            new UpdateOrderItemDto
            {
                ProductId = fixture.Product.PublicId,
                Quantity = fixture.Item.Quantity,
                ReminderState = fixture.Item.ReminderState,
                Note = fixture.Item.Note
            }
        ]);
}
