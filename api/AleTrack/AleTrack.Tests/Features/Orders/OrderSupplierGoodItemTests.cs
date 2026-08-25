using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
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
/// Lines on an order that buy off a supplier's price list. They live in their own collection
/// rather than in <see cref="Order.OrderItems"/>, which is what keeps them out of the nakládka
/// and the invoice split — those read order items and assume a brewery product behind each one.
/// </summary>
public sealed class OrderSupplierGoodItemTests
{
    [Fact]
    public async Task HandleAsync_CreateOrder_PersistsSupplierGoodLines()
    {
        var f = BuildCatalog();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], products: [f.Product], suppliers: [f.Supplier], supplierGoods: [f.Good]);

        var data = OrderBuilder.BuildCreateDto(
            clientId: f.Client.PublicId,
            orderItems: [new CreateOrderItemDto { ProductId = f.Product.PublicId, Quantity = 4 }]);
        data.SupplierGoodItems =
        [
            new OrderSupplierGoodItemDto { SupplierGoodId = f.Good.PublicId, Quantity = 2, Note = "Výměnou za prázdné" }
        ];

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new CreateOrderRequest { Data = data }, CancellationToken.None);

        var order = f.Client.Orders.Should().ContainSingle().Subject;
        var line = order.SupplierGoodItems.Should().ContainSingle().Subject;
        line.SupplierGood.Should().BeSameAs(f.Good);
        line.Quantity.Should().Be(2);
        line.Note.Should().Be("Výměnou za prázdné");

        order.OrderItems.Should().ContainSingle("the beer line is unaffected");

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_CreateOrderWithUnknownGood_ReportsNotFound()
    {
        var f = BuildCatalog();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], products: [f.Product], suppliers: [f.Supplier], supplierGoods: [f.Good]);

        var data = OrderBuilder.BuildCreateDto(clientId: f.Client.PublicId, orderItems: []);
        data.SupplierGoodItems = [new OrderSupplierGoodItemDto { SupplierGoodId = Guid.NewGuid(), Quantity = 1 }];

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(
            new CreateOrderRequest { Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    /// <summary>
    /// An order can be nothing but supplier goods — a client asking only for a CO₂ refill has
    /// placed a real order.
    /// </summary>
    [Fact]
    public async Task HandleAsync_CreateOrderWithOnlySupplierGoods_Succeeds()
    {
        var f = BuildCatalog();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], products: [f.Product], suppliers: [f.Supplier], supplierGoods: [f.Good]);

        var data = OrderBuilder.BuildCreateDto(clientId: f.Client.PublicId, orderItems: []);
        data.SupplierGoodItems = [new OrderSupplierGoodItemDto { SupplierGoodId = f.Good.PublicId, Quantity = 1 }];

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new CreateOrderRequest { Data = data }, CancellationToken.None);

        var order = f.Client.Orders.Should().ContainSingle().Subject;
        order.OrderItems.Should().BeEmpty();
        order.SupplierGoodItems.Should().ContainSingle();
    }

    [Fact]
    public async Task HandleAsync_UpdateOrder_AddsEditsAndDropsSupplierGoodLines()
    {
        var f = BuildCatalog();

        var keptId = Guid.NewGuid();
        var droppedId = Guid.NewGuid();
        var second = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), id: 2, name: "Dusík láhev", size: "50 l");
        second.Supplier = f.Supplier;

        var order = BuildOrder(f, OrderState.Planning);
        order.SupplierGoodItems =
        [
            new OrderSupplierGoodItem { PublicId = keptId, SupplierGood = f.Good, Quantity = 1, Note = "Původní" },
            new OrderSupplierGoodItem { PublicId = droppedId, SupplierGood = second, Quantity = 3 }
        ];

        var dbContext = MockFor(f, order, [f.Good, second]);

        var data = EchoDto(f, order);
        data.SupplierGoodItems =
        [
            // existing row: quantity up, note cleared
            new OrderSupplierGoodItemDto { Id = keptId, SupplierGoodId = f.Good.PublicId, Quantity = 5, Note = null },
            // newly added row
            new OrderSupplierGoodItemDto { SupplierGoodId = second.PublicId, Quantity = 2, Note = "Nový" }
            // droppedId left out entirely
        ];

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(new UpdateOrderRequest { Id = order.PublicId, Data = data }, CancellationToken.None);

        order.SupplierGoodItems.Should().HaveCount(2);

        var kept = order.SupplierGoodItems.Should().ContainSingle(i => i.PublicId == keptId).Subject;
        kept.Quantity.Should().Be(5);
        kept.Note.Should().BeNull();

        order.SupplierGoodItems.Should().ContainSingle(i => i.Note == "Nový")
            .Which.SupplierGood.Should().BeSameAs(second);

        order.SupplierGoodItems.Should().NotContain(i => i.PublicId == droppedId);
    }

    /// <summary>
    /// The whole point of the separate collection: these lines are not the shipment's content,
    /// so editing them on a delivered order is allowed rather than rejected as frozen.
    /// </summary>
    [Fact]
    public async Task HandleAsync_UpdateSupplierGoodsOnFrozenOrder_SucceedsAndKeepsOrderItemRow()
    {
        var f = BuildCatalog();

        var order = BuildOrder(f, OrderState.Finished);
        order.OutgoingShipmentStop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            OutgoingShipment = OutgoingShipmentBuilder.BuildEntity(state: OutgoingShipmentState.Delivered)
        };

        var storedItem = order.OrderItems.Single();

        var dbContext = MockFor(f, order, [f.Good]);

        var data = EchoDto(f, order);
        data.SupplierGoodItems = [new OrderSupplierGoodItemDto { SupplierGoodId = f.Good.PublicId, Quantity = 1 }];

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(new UpdateOrderRequest { Id = order.PublicId, Data = data }, CancellationToken.None);

        order.SupplierGoodItems.Should().ContainSingle().Which.Quantity.Should().Be(1);
        order.OrderItems.Should().ContainSingle()
            .Which.Should().BeSameAs(storedItem, "the item rebuild must stay skipped — invoice lines cascade off it");
    }

    [Fact]
    public async Task HandleAsync_GetOrderDetail_ProjectsSupplierGoodLinesWithFillPrice()
    {
        var f = BuildCatalog();

        // Deliberately out of charge-kind order: the projection must pick Fill, not the first row.
        f.Good.Prices =
        [
            SupplierBuilder.BuildPrice(SupplierChargeKind.Deposit, 2500m, null),
            SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 450m, 372m)
        ];

        var lineId = Guid.NewGuid();
        var order = BuildOrder(f, OrderState.Planning);
        order.SupplierGoodItems =
        [
            new OrderSupplierGoodItem { PublicId = lineId, SupplierGood = f.Good, Quantity = 2, Note = "Ráno" }
        ];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], orders: [order], suppliers: [f.Supplier], supplierGoods: [f.Good]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = order.PublicId }, CancellationToken.None);

        var line = endpoint.Response.SupplierGoodItems.Should().ContainSingle().Subject;
        line.Id.Should().Be(lineId);
        line.SupplierGoodId.Should().Be(f.Good.PublicId);
        line.Quantity.Should().Be(2);
        line.Note.Should().Be("Ráno");
        line.GoodName.Should().Be(f.Good.Name);
        line.GoodSize.Should().Be(f.Good.Size);
        line.SupplierId.Should().Be(f.Supplier.PublicId);
        line.SupplierName.Should().Be(f.Supplier.Name);
        line.UnitPriceWithVat.Should().Be(450m);
        line.ChargeKind.Should().Be(SupplierChargeKind.Fill);
    }

    /// <summary>
    /// A good priced without a Fill row still has to price — the picker offers whatever the
    /// good does charge for.
    /// </summary>
    [Fact]
    public async Task HandleAsync_GetOrderDetail_FallsBackToFirstPriceWhenNoFill()
    {
        var f = BuildCatalog();
        f.Good.Prices = [SupplierBuilder.BuildPrice(SupplierChargeKind.Purchase, 1800m, null)];

        var order = BuildOrder(f, OrderState.Planning);
        order.SupplierGoodItems = [new OrderSupplierGoodItem { PublicId = Guid.NewGuid(), SupplierGood = f.Good, Quantity = 1 }];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], orders: [order], suppliers: [f.Supplier], supplierGoods: [f.Good]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = order.PublicId }, CancellationToken.None);

        var line = endpoint.Response.SupplierGoodItems.Should().ContainSingle().Subject;
        line.UnitPriceWithVat.Should().Be(1800m);
        line.ChargeKind.Should().Be(SupplierChargeKind.Purchase);
    }

    [Fact]
    public void Validator_RejectsEmptyGoodNonPositiveQuantityAndOverlongNote()
    {
        var validator = new OrderSupplierGoodItemDtoValidator();
        var goodId = Guid.NewGuid();

        validator.Validate(new OrderSupplierGoodItemDto { SupplierGoodId = Guid.Empty, Quantity = 1 })
            .Errors.Should().Contain(e => e.PropertyName == nameof(OrderSupplierGoodItemDto.SupplierGoodId));

        validator.Validate(new OrderSupplierGoodItemDto { SupplierGoodId = goodId, Quantity = 0 })
            .Errors.Should().Contain(e => e.PropertyName == nameof(OrderSupplierGoodItemDto.Quantity));

        validator.Validate(new OrderSupplierGoodItemDto { SupplierGoodId = goodId, Quantity = 1, Note = new string('x', 501) })
            .Errors.Should().Contain(e => e.PropertyName == nameof(OrderSupplierGoodItemDto.Note));

        validator.Validate(new OrderSupplierGoodItemDto { SupplierGoodId = goodId, Quantity = 1, Note = new string('x', 500) })
            .IsValid.Should().BeTrue();
    }

    private sealed record Catalog(Client Client, Product Product, Supplier Supplier, SupplierGood Good);

    private static Catalog BuildCatalog()
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid());
        product.Id = 41;
        product.Brewery = BreweryBuilder.BuildEntity();

        var supplier = SupplierBuilder.BuildEntity(publicId: Guid.NewGuid());
        var good = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), supplierId: supplier.Id);
        good.Supplier = supplier;
        supplier.Goods = [good];

        return new Catalog(client, product, supplier, good);
    }

    private static Order BuildOrder(Catalog f, OrderState state)
    {
        var item = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = f.Product,
            ProductId = f.Product.Id,
            Quantity = 15
        };

        var order = OrderBuilder.BuildEntity(
            publicId: Guid.NewGuid(), client: f.Client, state: state, orderItems: [item]);
        // The detail projection reads i.Order.PublicId, so the back-reference has to be there.
        item.Order = order;
        return order;
    }

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockFor(
        Catalog f, Order order, ICollection<SupplierGood> goods)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.Product],
            orders: [order],
            suppliers: [f.Supplier],
            supplierGoods: goods);
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return dbContext;
    }

    /// <summary>The order's current content, as the order screen re-sends it on every save.</summary>
    private static UpdateOrderDto EchoDto(Catalog f, Order order) => OrderBuilder.BuildUpdateDto(
        clientId: f.Client.PublicId,
        state: order.State,
        actualDeliveryDate: order.ActualDeliveryDate,
        orderItems:
        [
            new UpdateOrderItemDto
            {
                ProductId = f.Product.PublicId,
                Quantity = order.OrderItems.Single().Quantity,
                ReminderState = order.OrderItems.Single().ReminderState
            }
        ]);
}
