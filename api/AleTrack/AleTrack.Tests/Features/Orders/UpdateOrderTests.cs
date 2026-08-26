using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
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

    // ---------------------------------------------------------------------------------
    // State and ActualDeliveryDate are optional patches.
    //
    // The order editor is a content editor: it sends items, notes, returns, extras and the
    // required date, and nothing about the lifecycle — that is the shipment's. While both
    // fields were non-nullable, an editor save posted the CLR defaults, so editing a
    // "plánuje se" order and pressing Uložit knocked it back to "nová" and wiped the
    // delivered date.
    // ---------------------------------------------------------------------------------

    /// <summary>
    /// What the order editor actually posts: content only, no state, no delivered date.
    /// </summary>
    private static UpdateOrderDto ContentOnlyDto(Guid clientId, List<UpdateOrderItemDto> items) =>
        OrderBuilder.BuildUpdateDto(clientId: clientId, state: null, actualDeliveryDate: null, orderItems: items);

    [Fact]
    public async Task ProcessAsync_UpdateWithoutState_KeepsTheStoredStateAndDeliveredDate()
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);
        order.ActualDeliveryDate = new DateOnly(2026, 8, 14);

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product], orders: [order]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var data = ContentOnlyDto(client.PublicId,
            [new UpdateOrderItemDto { ProductId = product.PublicId, Quantity = 4 }]);

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(new UpdateOrderRequest { Id = order.PublicId, Data = data }, CancellationToken.None);

        order.State.Should().Be(OrderState.Planning, "the editor edits content, not the lifecycle");
        order.ActualDeliveryDate.Should().Be(new DateOnly(2026, 8, 14));
        order.OrderItems.Should().ContainSingle().Which.Quantity.Should().Be(4);
    }

    /// <summary>
    /// The same omission must not read as a change on a frozen order either, or a note-only
    /// save on a delivered order would 400.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateNotesOfFinishedOrderWithoutState_Succeeds()
    {
        var f = BuildFreezeFixture(OrderState.Finished, OutgoingShipmentState.Delivered);
        f.Order.ActualDeliveryDate = new DateOnly(2026, 8, 10);
        var db = MockForFreeze(f);

        var data = OrderBuilder.BuildUpdateDto(
            clientId: f.Client.PublicId,
            state: null,
            actualDeliveryDate: null,
            orderItems:
            [
                new UpdateOrderItemDto
                {
                    ProductId = f.Product.PublicId,
                    Quantity = f.Item.Quantity,
                    ReminderState = f.Item.ReminderState
                }
            ],
            notes: [new OrderNoteDto { Text = "Reklamace vyřízena." }]);

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.State.Should().Be(OrderState.Finished);
        f.Order.ActualDeliveryDate.Should().Be(new DateOnly(2026, 8, 10));
        f.Order.Notes.Should().ContainSingle();
    }

    /// <summary>
    /// A caller that does send a state still drives it — the freeze guard included.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateWithExplicitState_StillApplies()
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product], orders: [order]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var data = OrderBuilder.BuildUpdateDto(
            clientId: client.PublicId,
            state: OrderState.Cancelled,
            orderItems: [new UpdateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(new UpdateOrderRequest { Id = order.PublicId, Data = data }, CancellationToken.None);

        order.State.Should().Be(OrderState.Cancelled);
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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        var act = async () => await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.OrderContentFrozen);

        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// Packing the van does not close the order. A client rings up, a pallet will not fit, the
    /// office spots a wrong line — that is the plan being corrected, and it happens while the run
    /// is loaded and on the road. What closes it is filing the run's invoicing.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    public async Task ProcessAsync_UpdateItemsOfOrderOnARunningShipment_Succeeds(OutgoingShipmentState shipmentState)
    {
        var f = BuildFreezeFixture(OrderState.Planning, shipmentState);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.OrderItems.Clear();

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.OrderItems.Should().BeEmpty();
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Filing the run's invoicing is the one-way door: past it the plan is what was filed, and
    /// what happens at the door is recorded beside it instead.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Created)]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    public async Task ProcessAsync_UpdateItemsOfOrderOnAFiledShipment_Fails(OutgoingShipmentState shipmentState)
    {
        var f = BuildFreezeFixture(OrderState.Planning, shipmentState);
        f.Order.OutgoingShipmentStop!.OutgoingShipment!.InvoicingFiledAt =
            new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.OrderItems.Clear();

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

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

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.OrderItems.Should().ContainSingle().Which.Quantity.Should().Be(3);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---------------------------------------------------------------------------------
    // Item merge instead of rebuild.
    //
    // The rebuild handed out fresh row IDs on every save, so three fields the order does not
    // own — is_shipment_loading_confirmed, quantity_from_inventory and inventory_item_id —
    // silently reset, and the line's invoice row cascaded away with the old row.
    // ---------------------------------------------------------------------------------

    private sealed record MergeFixture(
        Order Order,
        Client Client,
        Product ProductA,
        Product ProductB,
        OrderItem ItemA,
        OrderItem ItemB);

    private static MergeFixture BuildMergeFixture()
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());

        var productA = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Ležák 12");
        productA.Id = 41;
        var productB = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Světlé 10");
        productB.Id = 42;

        var itemA = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = productA,
            ProductId = productA.Id,
            Quantity = 15,
            ReminderState = OrderItemReminderState.Added
        };

        var itemB = new OrderItem
        {
            Id = 52,
            PublicId = Guid.NewGuid(),
            Product = productB,
            ProductId = productB.Id,
            Quantity = 4
        };

        var order = OrderBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            client: client,
            state: OrderState.Planning,
            orderItems: [itemA, itemB]);

        return new MergeFixture(order, client, productA, productB, itemA, itemB);
    }

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockForMerge(
        MergeFixture f,
        ICollection<OutgoingShipmentInvoiceLine>? invoiceLines = null)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.ProductA, f.ProductB],
            orders: [f.Order],
            outgoingShipmentInvoiceLines: invoiceLines);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    private static UpdateOrderDto MergeDto(MergeFixture f, params UpdateOrderItemDto[] items) =>
        OrderBuilder.BuildUpdateDto(
            clientId: f.Client.PublicId,
            state: null,
            actualDeliveryDate: null,
            orderItems: [.. items]);

    private static Task HandleMergeAsync(
        Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db,
        Order order,
        UpdateOrderDto data)
    {
        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(
            db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        return endpoint.HandleAsync(new UpdateOrderRequest { Id = order.PublicId, Data = data }, CancellationToken.None);
    }

    /// <summary>
    /// A quantity change on one line must not re-key the others: the row IDs are what the
    /// invoice lines hang off.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_ChangeOneItemQuantity_KeepsRowIdentityOfEveryLine()
    {
        var f = BuildMergeFixture();
        var db = MockForMerge(f);

        var storedAPublicId = f.ItemA.PublicId;
        var storedBPublicId = f.ItemB.PublicId;

        await HandleMergeAsync(db, f.Order, MergeDto(f,
            new UpdateOrderItemDto { ProductId = f.ProductA.PublicId, Quantity = 9, ReminderState = OrderItemReminderState.Added },
            new UpdateOrderItemDto { ProductId = f.ProductB.PublicId, Quantity = 4 }));

        f.Order.OrderItems.Should().HaveCount(2);
        f.Order.OrderItems.Should().Contain(f.ItemA, "the row is updated in place, not replaced");
        f.Order.OrderItems.Should().Contain(f.ItemB);

        f.ItemA.Id.Should().Be(51);
        f.ItemA.PublicId.Should().Be(storedAPublicId);
        f.ItemA.Quantity.Should().Be(9);
        f.ItemB.Id.Should().Be(52);
        f.ItemB.PublicId.Should().Be(storedBPublicId);
    }

    /// <summary>
    /// The three fields the shipment owns, not the order: ticked off while packing, and split
    /// against stock. Saving the order must leave them alone.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateOrder_KeepsShipmentOwnedItemFields()
    {
        var f = BuildMergeFixture();
        f.ItemA.IsShipmentLoadingConfirmed = true;
        f.ItemA.QuantityFromInventory = 6;
        f.ItemA.InventoryItemId = 77;

        var db = MockForMerge(f);

        await HandleMergeAsync(db, f.Order, MergeDto(f,
            new UpdateOrderItemDto { ProductId = f.ProductA.PublicId, Quantity = 15, ReminderState = OrderItemReminderState.Added },
            new UpdateOrderItemDto { ProductId = f.ProductB.PublicId, Quantity = 7 }));

        f.ItemA.IsShipmentLoadingConfirmed.Should().BeTrue();
        f.ItemA.QuantityFromInventory.Should().Be(6);
        f.ItemA.InventoryItemId.Should().Be(77);
        f.ItemB.Quantity.Should().Be(7);
    }

    /// <summary>
    /// Cutting the ordered quantity below the sourced part trims the split rather than
    /// discarding it — the rule supplier-good lines already follow.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_ReduceQuantityBelowInventorySourcing_ClampsInsteadOfClearing()
    {
        var f = BuildMergeFixture();
        f.ItemA.QuantityFromInventory = 10;
        f.ItemA.InventoryItemId = 77;

        var db = MockForMerge(f);

        await HandleMergeAsync(db, f.Order, MergeDto(f,
            new UpdateOrderItemDto { ProductId = f.ProductA.PublicId, Quantity = 3, ReminderState = OrderItemReminderState.Added },
            new UpdateOrderItemDto { ProductId = f.ProductB.PublicId, Quantity = 4 }));

        f.ItemA.Quantity.Should().Be(3);
        f.ItemA.QuantityFromInventory.Should().Be(3, "only the part that no longer exists is dropped");
        f.ItemA.InventoryItemId.Should().Be(77);
    }

    /// <summary>
    /// Merge does not mean "nothing is ever deleted": a line left out of the save is removed,
    /// and its invoice line goes with it through the FK cascade.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_DropItemFromOrder_RemovesTheRowSoItsInvoiceLineCascades()
    {
        var f = BuildMergeFixture();

        var lineForA = InvoiceLineFor(f.ItemA);
        var lineForB = InvoiceLineFor(f.ItemB);

        var db = MockForMerge(f, [lineForA, lineForB]);

        await HandleMergeAsync(db, f.Order, MergeDto(f,
            new UpdateOrderItemDto { ProductId = f.ProductA.PublicId, Quantity = 15, ReminderState = OrderItemReminderState.Added }));

        f.Order.OrderItems.Should().ContainSingle().Which.Should().BeSameAs(f.ItemA);

        var liveItemIds = f.Order.OrderItems.Select(i => i.Id).ToList();
        liveItemIds.Should().Contain(lineForA.OrderItemId!.Value, "the kept line still bills a live row");
        liveItemIds.Should().NotContain(lineForB.OrderItemId!.Value, "the dropped row takes its invoice line with it");

        // The removal above deletes that invoice line only because the FK says so.
        typeof(OutgoingShipmentInvoiceLine)
            .GetProperty(nameof(OutgoingShipmentInvoiceLine.OrderItem))!
            .GetCustomAttributes(typeof(DeleteBehaviorAttribute), inherit: false)
            .Cast<DeleteBehaviorAttribute>()
            .Should().ContainSingle()
            .Which.Behavior.Should().Be(DeleteBehavior.Cascade);
    }

    /// <summary>
    /// The point of the merge: an ordinary save leaves every untouched line's invoice row
    /// pointing at a row that still exists.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateOrder_KeepsInvoiceLinesOfUntouchedItemsResolvable()
    {
        var f = BuildMergeFixture();

        var lineForA = InvoiceLineFor(f.ItemA);
        var lineForB = InvoiceLineFor(f.ItemB);

        var db = MockForMerge(f, [lineForA, lineForB]);

        await HandleMergeAsync(db, f.Order, MergeDto(f,
            new UpdateOrderItemDto { ProductId = f.ProductA.PublicId, Quantity = 11, ReminderState = OrderItemReminderState.Added },
            new UpdateOrderItemDto { ProductId = f.ProductB.PublicId, Quantity = 4 }));

        var liveItemIds = f.Order.OrderItems.Select(i => i.Id).ToList();
        liveItemIds.Should().Contain(lineForA.OrderItemId!.Value);
        liveItemIds.Should().Contain(lineForB.OrderItemId!.Value);
    }

    private static OutgoingShipmentInvoiceLine InvoiceLineFor(OrderItem item) => new()
    {
        PublicId = Guid.NewGuid(),
        SourceKind = InvoiceLineSourceKind.OrderItem,
        OrderItemId = item.Id,
        Quantity = item.Quantity
    };

    /// <summary>
    /// A newly added product still gets its own row.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_AddProductToOrder_AppendsANewRow()
    {
        var f = BuildMergeFixture();
        f.Order.OrderItems.Remove(f.ItemB);

        var db = MockForMerge(f);

        await HandleMergeAsync(db, f.Order, MergeDto(f,
            new UpdateOrderItemDto { ProductId = f.ProductA.PublicId, Quantity = 15, ReminderState = OrderItemReminderState.Added },
            new UpdateOrderItemDto { ProductId = f.ProductB.PublicId, Quantity = 2 }));

        f.Order.OrderItems.Should().HaveCount(2);
        f.Order.OrderItems.Should().Contain(f.ItemA);
        f.Order.OrderItems.Should().Contain(i => i.Product == f.ProductB && i.Quantity == 2 && i.Id == 0);
    }

    /// <summary>
    /// Item notes are written by their own pass, outside the freeze gate, so they stay
    /// editable once the order is delivered — and the row keeps its identity.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateItemNoteOfFinishedOrder_WritesTheNoteAndKeepsTheRow()
    {
        var f = BuildFreezeFixture(OrderState.Finished, OutgoingShipmentState.Delivered);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.OrderItems[0].Note = "Nechat u zadního vchodu.";

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.OrderItems.Should().ContainSingle().Which.Should().BeSameAs(f.Item);
        f.Item.Note.Should().Be("Nechat u zadního vchodu.");
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---------------------------------------------------------------------------------
    // The destination is not frozen content.
    //
    // What freezes when the truck is packed is what is on it. Where a client takes delivery is
    // something that client can still change afterwards — ringing mid-run to say they cannot
    // make it is the commonest deviation there is — so the move is allowed and recorded in the
    // client's ledger instead of being refused.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task ProcessAsync_MoveTheAddressOfAnOrderOnALoadedShipment_Succeeds()
    {
        var f = BuildFreezeFixture(OrderState.Planning, OutgoingShipmentState.Loaded);
        f.Client.ContactAddress = AddressBuilder.BuildEntity(streetName: "Krátká", streetNumber: "2");
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.DeliveryAddressKind = DeliveryAddressKind.Contact;

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(
            db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.DeliveryAddressKind.Should().Be(DeliveryAddressKind.Contact);
        f.Order.OrderItems.Should().ContainSingle().Which.Should().BeSameAs(f.Item,
            "the echoed line is matched, not rebuilt");
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// The client of an order on a loaded run can be corrected too — a mis-keyed client is a
    /// mistake in the plan like any other, and until the paperwork is filed the plan is what is
    /// being corrected. Refused only once it is filed.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_ChangeTheClientOfAnOrderOnAFiledShipment_Fails()
    {
        var f = BuildFreezeFixture(OrderState.Planning, OutgoingShipmentState.Loaded);
        f.Order.OutgoingShipmentStop!.OutgoingShipment!.InvoicingFiledAt =
            new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc);
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.ClientId = Guid.NewGuid();

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(
            db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        var act = async () => await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.OrderContentFrozen);
    }

    /// <summary>
    /// A delivery that already happened is history: moving it would be rewriting the record
    /// rather than recording it.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_MoveTheAddressOfAFinishedOrder_LeavesItAlone()
    {
        var f = BuildFreezeFixture(OrderState.Finished, OutgoingShipmentState.Delivered);
        f.Client.ContactAddress = AddressBuilder.BuildEntity(streetName: "Krátká", streetNumber: "2");
        var db = MockForFreeze(f);

        var data = EchoDto(f);
        data.DeliveryAddressKind = DeliveryAddressKind.Contact;

        var endpoint = EndpointWithResponseBuilder<UpdateOrderRequest, UpdateOrderResultDto, UpdateOrderEndpoint>.Create(
            db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(
            new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);

        f.Order.DeliveryAddressKind.Should().Be(DeliveryAddressKind.Official);
    }
}
