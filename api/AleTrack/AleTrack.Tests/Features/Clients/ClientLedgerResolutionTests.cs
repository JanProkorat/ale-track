using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Delete;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using Client = AleTrack.Entities.Client;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The three resolution states and the edges between them: open, assigned to an order that
/// promises to settle it, and settled.
/// </summary>
/// <remarks>
/// The middle state is the safeguard. Closing an entry the moment somebody clicks "add to order"
/// would make the debt vanish if that order were later cancelled — the exact failure the whole
/// feature exists to prevent.
/// </remarks>
public sealed class ClientLedgerResolutionTests
{
    private const long ClientRowId = 11;
    private const long OrderRowId = 21;
    private const long ProductRowId = 41;

    private sealed record Fixture(Client Client, Order Order, Product Product, ClientLedgerEntry Entry);

    private static Fixture Build(OrderState orderState = OrderState.Planning)
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        client.Id = ClientRowId;

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Ležák 12");
        product.Id = ProductRowId;

        var order = OrderBuilder.BuildEntity(client: client, state: orderState);
        order.Id = OrderRowId;
        order.ClientId = client.Id;

        var entry = new ClientLedgerEntry
        {
            Id = 301,
            PublicId = Guid.NewGuid(),
            ClientId = ClientRowId,
            Target = ClientLedgerEntryTarget.ProductQuantity,
            ProductId = ProductRowId,
            ProductName = "Ležák 12",
            PlannedQuantity = 10,
            ActualQuantity = 7,
            RequiresFollowUp = true,
            CreatedAt = new DateTime(2026, 8, 20, 9, 0, 0, DateTimeKind.Utc)
        };

        return new Fixture(client, order, product, entry);
    }

    private static Mock<AleTrackDbContext> BuildDb(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.Product],
            orders: [f.Order],
            clientLedgerEntries: [f.Entry]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    private static UpdateOrderDto SaveWith(Fixture f, params Guid[] settledEntryIds)
    {
        var dto = OrderBuilder.BuildUpdateDto(
            clientId: f.Client.PublicId,
            state: null,
            actualDeliveryDate: null,
            orderItems: [new UpdateOrderItemDto { ProductId = f.Product.PublicId, Quantity = 3 }]);

        dto.SettledLedgerEntryIds = [.. settledEntryIds];
        return dto;
    }

    private static Task UpdateOrderAsync(Mock<AleTrackDbContext> db, Fixture f, UpdateOrderDto data)
    {
        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(
            db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        return endpoint.HandleAsync(new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);
    }

    // ---------------------------------------------------------------------------------
    // Assignment: a promise, not a settlement.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task SaveOrder_WithAnAssignedEntry_LinksItWithoutSettlingIt()
    {
        var f = Build();
        var db = BuildDb(f);

        await UpdateOrderAsync(db, f, SaveWith(f, f.Entry.PublicId));

        f.Entry.ResolvedByOrderId.Should().Be(OrderRowId);
        f.Entry.ResolvedAt.Should().BeNull("promising is not delivering");
    }

    [Fact]
    public async Task SaveOrder_DroppingAnEntryItWasCarrying_ReleasesItBackToOpen()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OrderRowId;
        var db = BuildDb(f);

        await UpdateOrderAsync(db, f, SaveWith(f));

        f.Entry.ResolvedByOrderId.Should().BeNull();
        f.Entry.ResolvedAt.Should().BeNull();
    }

    /// <summary>
    /// Two orders must not both promise the same three kegs.
    /// </summary>
    [Fact]
    public async Task SaveOrder_AssigningAnEntryAnotherOrderCarries_LeavesItAlone()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = 99;
        var db = BuildDb(f);

        await UpdateOrderAsync(db, f, SaveWith(f, f.Entry.PublicId));

        f.Entry.ResolvedByOrderId.Should().Be(99);
    }

    [Fact]
    public async Task SaveOrder_AssigningASettledEntry_LeavesItAlone()
    {
        var f = Build();
        f.Entry.ResolvedAt = new DateTime(2026, 8, 22, 9, 0, 0, DateTimeKind.Utc);
        var db = BuildDb(f);

        await UpdateOrderAsync(db, f, SaveWith(f, f.Entry.PublicId));

        f.Entry.ResolvedByOrderId.Should().BeNull("a settled entry is history");
    }

    /// <summary>
    /// An entry of a different client is not this order's to carry.
    /// </summary>
    [Fact]
    public async Task SaveOrder_AssigningAnotherClientsEntry_LeavesItAlone()
    {
        var f = Build();
        f.Entry.ClientId = 12;
        var db = BuildDb(f);

        await UpdateOrderAsync(db, f, SaveWith(f, f.Entry.PublicId));

        f.Entry.ResolvedByOrderId.Should().BeNull();
    }

    // ---------------------------------------------------------------------------------
    // Settlement, on the edge that delivers the order.
    // ---------------------------------------------------------------------------------

    private static (OutgoingShipment Shipment, Fixture Fixture, Mock<AleTrackDbContext> Db) OnARun(
        OutgoingShipmentState state)
    {
        var f = Build(OrderState.Delivering);
        f.Entry.ResolvedByOrderId = OrderRowId;
        f.Order.RequiredDeliveryDate = new DateOnly(2026, 8, 26);

        var vehicle = VehicleBuilder.BuildEntity(publicId: Guid.NewGuid());
        vehicle.Id = 81;

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            deliveryDate: new DateTime(2026, 8, 26, 6, 0, 0, DateTimeKind.Utc),
            state: state,
            vehicle: vehicle,
            drivers: [new OutgoingShipmentDriver { Driver = DriverBuilder.BuildEntity(publicId: Guid.NewGuid()) }],
            stops:
            [
                new OutgoingShipmentStop
                {
                    Id = 31,
                    PublicId = Guid.NewGuid(),
                    Kind = OutgoingShipmentStopKind.Order,
                    Order = 1,
                    ClientOrder = f.Order
                }
            ]);
        shipment.VehicleId = vehicle.Id;

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.Product],
            orders: [f.Order],
            outgoingShipments: [shipment],
            clientLedgerEntries: [f.Entry]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        return (shipment, f, db);
    }

    [Fact]
    public async Task DeliverTheRun_SettlesWhatItsOrdersWereCarrying()
    {
        var (shipment, f, db) = OnARun(OutgoingShipmentState.InTransit);

        await ShipmentStateTransition.ApplyAsync(
            db.Object, shipment, OutgoingShipmentState.Delivered, CancellationToken.None);

        f.Order.State.Should().Be(OrderState.Finished);
        f.Entry.ResolvedAt.Should().NotBeNull();
        f.Entry.ResolutionNote.Should().Contain("doručením objednávky");
    }

    [Fact]
    public async Task DeliverTheRun_LeavesUnassignedEntriesOpen()
    {
        var (shipment, f, db) = OnARun(OutgoingShipmentState.InTransit);
        f.Entry.ResolvedByOrderId = null;

        await ShipmentStateTransition.ApplyAsync(
            db.Object, shipment, OutgoingShipmentState.Delivered, CancellationToken.None);

        f.Entry.ResolvedAt.Should().BeNull("nobody promised to settle it");
    }

    /// <summary>
    /// The easiest thing in the feature to get backwards. A cancelled run only frees its orders
    /// back to New for re-planning; the order still exists and still carries the debt.
    /// </summary>
    [Fact]
    public async Task CancelTheRun_LeavesTheAssignmentAlone()
    {
        var (shipment, f, db) = OnARun(OutgoingShipmentState.InTransit);

        await ShipmentStateTransition.ApplyAsync(
            db.Object, shipment, OutgoingShipmentState.Cancelled, CancellationToken.None);

        f.Order.State.Should().Be(OrderState.New);
        f.Entry.ResolvedByOrderId.Should().Be(OrderRowId, "the order still carries it");
        f.Entry.ResolvedAt.Should().BeNull();
    }

    // ---------------------------------------------------------------------------------
    // Cancelling the order itself withdraws the promise.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task CancelTheOrder_PutsWhatItCarriedBackAmongTheOpenPoints()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OrderRowId;
        var db = BuildDb(f);

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(db.Object);
        await endpoint.HandleAsync(new DeleteOrderRequest { Id = f.Order.PublicId }, CancellationToken.None);

        f.Entry.ResolvedByOrderId.Should().BeNull();
        f.Entry.ResolvedAt.Should().BeNull();
    }

    /// <summary>
    /// Cancelling the order does not un-deliver goods that already went out, so an entry it had
    /// already settled stays settled.
    /// </summary>
    [Fact]
    public async Task CancelTheOrder_LeavesAlreadySettledEntriesSettled()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OrderRowId;
        f.Entry.ResolvedAt = new DateTime(2026, 8, 22, 9, 0, 0, DateTimeKind.Utc);
        var db = BuildDb(f);

        var endpoint = EndpointBuilder<DeleteOrderRequest, DeleteOrderEndpoint>.Create(db.Object);
        await endpoint.HandleAsync(new DeleteOrderRequest { Id = f.Order.PublicId }, CancellationToken.None);

        f.Entry.ResolvedAt.Should().NotBeNull();
        f.Entry.ResolvedByOrderId.Should().Be(OrderRowId);
    }

    [Fact]
    public async Task SaveOrderAsCancelled_PutsWhatItCarriedBackAmongTheOpenPoints()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OrderRowId;
        var db = BuildDb(f);

        var data = SaveWith(f);
        data.State = OrderState.Cancelled;

        await UpdateOrderAsync(db, f, data);

        f.Entry.ResolvedByOrderId.Should().BeNull();
    }
}
