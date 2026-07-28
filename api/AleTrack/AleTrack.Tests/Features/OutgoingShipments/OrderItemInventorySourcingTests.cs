using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// A client orders 20; the brewery supplies 15; the missing 5 come out of our stock.
/// The order still says 20 — sourcing only records where the goods came from, and it
/// is the shipment's business, not the order's.
/// </summary>
public sealed class OrderItemInventorySourcingTests
{
    private sealed record Fixture(
        OutgoingShipment Shipment,
        Order Order,
        OrderItem Item,
        OrderCustomExtraItem CustomExtra,
        InventoryItem Stock,
        Client Client);

    private static Fixture BuildFixture(
        OutgoingShipmentState state = OutgoingShipmentState.Created,
        bool withCustomStop = false,
        int ordered = 20,
        int stockQuantity = 30)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        client.Id = 11;

        var product = ProductBuilder.BuildEntity(name: "Albrecht 12°");
        // The detail projection orders items by their brewery, so the fixture needs one.
        product.Brewery = BreweryBuilder.BuildEntity();
        var stock = new InventoryItem { Id = 31, PublicId = Guid.NewGuid(), Name = "Sud 50 l", Quantity = stockQuantity, Product = product };

        var item = new OrderItem { Id = 51, PublicId = Guid.NewGuid(), Product = product, Quantity = ordered };
        var customExtra = new OrderCustomExtraItem { Id = 61, PublicId = Guid.NewGuid(), Description = "Tácky", Quantity = 100 };

        var order = OrderBuilder.BuildEntity(client: client, state: OrderState.Planning, orderItems: [item]);
        order.Id = 101;
        order.ClientId = 11;
        order.CustomExtraItems.Add(customExtra);

        var stops = new List<OutgoingShipmentStop>
        {
            new() { PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1, ClientOrder = order }
        };
        if (withCustomStop)
            // Coordinates are not decoration: a real custom stop always has them (they come
            // from a map pick or an address hit), and the content diff compares them.
            stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(),
                Kind = OutgoingShipmentStopKind.Custom,
                Order = 2,
                Label = "Čerpací stanice",
                Latitude = 49.2m,
                Longitude = 16.6m
            });

        return new Fixture(OutgoingShipmentBuilder.BuildEntity(state: state, stops: stops), order, item, customExtra, stock, client);
    }

    /// <summary>
    /// Mirrors what the UI sends: the shipment's whole current content with only the state
    /// and the loading fields varied. Echoing the custom stops back matters — content is
    /// frozen from Loaded onward, so a request that silently dropped them would be rejected
    /// as a content change rather than testing what it means to test.
    /// </summary>
    private static UpdateOutgoingShipmentRequest Request(
        Fixture f, OutgoingShipmentState state, int fromInventory = 0, Guid? inventoryId = null, bool confirmExtra = false) => new()
    {
        Id = f.Shipment.PublicId,
        Data = new UpdateOutgoingShipmentDto
        {
            Name = "vyvoz",
            DeliveryDate = DateTime.UtcNow.AddDays(1),
            State = state,
            CustomStops = [.. f.Shipment.Stops
                .Where(s => s.Kind == OutgoingShipmentStopKind.Custom)
                .Select(s => new CustomStopDto
                {
                    Id = s.PublicId,
                    Order = s.Order,
                    Label = s.Label!,
                    Note = s.Note,
                    Latitude = s.Latitude!.Value,
                    Longitude = s.Longitude!.Value
                })],
            ClientOrderShipments =
            [
                new ClientOrderShipmentDto
                {
                    ClientOrderId = f.Order.PublicId,
                    Order = 1,
                    OrderItems =
                    [
                        new OrderItemInfoDto
                        {
                            OrderItemId = f.Item.PublicId,
                            IsLoadingConfirmed = true,
                            QuantityFromInventory = fromInventory,
                            InventoryItemId = fromInventory > 0 ? inventoryId ?? f.Stock.PublicId : null
                        }
                    ],
                    CustomExtraItems = confirmExtra
                        ? [new ExtraItemInfoDto { Id = f.CustomExtra.PublicId, IsLoadingConfirmed = true }]
                        : []
                }
            ]
        }
    };

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockFor(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], orders: [f.Order], outgoingShipments: [f.Shipment], inventoryItems: [f.Stock]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    private static UpdateOutgoingShipmentEndpoint Endpoint(Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db) =>
        EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object);

    [Fact]
    public async Task Update_RecordsHowManyPiecesCameFromStock()
    {
        var f = BuildFixture(ordered: 20);

        await Endpoint(MockFor(f)).HandleAsync(Request(f, OutgoingShipmentState.Created, fromInventory: 5), CancellationToken.None);

        f.Item.Quantity.Should().Be(20, "the client still ordered twenty");
        f.Item.QuantityFromInventory.Should().Be(5);
        f.Item.InventoryItemId.Should().Be(f.Stock.Id);
    }

    [Fact]
    public async Task Update_SourcingMoreThanWasOrdered_IsRejected()
    {
        var f = BuildFixture(ordered: 20);

        var act = async () => await Endpoint(MockFor(f))
            .HandleAsync(Request(f, OutgoingShipmentState.Created, fromInventory: 21), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task Update_SourcingMoreThanIsInStock_IsAllowed()
    {
        // Deliberately not an error: a booked delivery may still land before loading.
        // The nakládka warns instead of blocking.
        var f = BuildFixture(ordered: 20, stockQuantity: 2);

        var act = async () => await Endpoint(MockFor(f))
            .HandleAsync(Request(f, OutgoingShipmentState.Created, fromInventory: 10), CancellationToken.None);

        await act.Should().NotThrowAsync();
        f.Item.QuantityFromInventory.Should().Be(10);
    }

    [Fact]
    public async Task Update_UnknownInventoryItem_IsRejected()
    {
        var f = BuildFixture();

        var act = async () => await Endpoint(MockFor(f))
            .HandleAsync(Request(f, OutgoingShipmentState.Created, fromInventory: 5, inventoryId: Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task Update_TransitionToLoaded_DrawsTheSourcedPiecesDown()
    {
        var f = BuildFixture(ordered: 20, stockQuantity: 30);
        f.Item.QuantityFromInventory = 5;
        f.Item.InventoryItem = f.Stock;
        f.Item.InventoryItemId = f.Stock.Id;

        await Endpoint(MockFor(f)).HandleAsync(Request(f, OutgoingShipmentState.Loaded, fromInventory: 5), CancellationToken.None);

        f.Stock.Quantity.Should().Be(25, "stock is consumed when the truck is packed");
    }

    [Fact]
    public async Task Update_Cancel_ClearsSourcingAndFlags_EvenWithACustomStopOnTheRoute()
    {
        // The custom stop is the regression guard: the reset used to dereference
        // ClientOrder unconditionally and would NRE on a route containing one.
        var f = BuildFixture(state: OutgoingShipmentState.Loaded, withCustomStop: true);
        f.Item.QuantityFromInventory = 5;
        f.Item.InventoryItem = f.Stock;
        f.Item.InventoryItemId = f.Stock.Id;
        f.Item.IsShipmentLoadingConfirmed = true;
        f.CustomExtra.IsShipmentLoadingConfirmed = true;

        var act = async () => await Endpoint(MockFor(f)).HandleAsync(Request(f, OutgoingShipmentState.Cancelled), CancellationToken.None);

        await act.Should().NotThrowAsync();
        f.Item.QuantityFromInventory.Should().Be(0);
        f.Item.InventoryItemId.Should().BeNull();
        f.Item.IsShipmentLoadingConfirmed.Should().BeFalse();
        f.CustomExtra.IsShipmentLoadingConfirmed.Should().BeFalse();
    }

    [Fact]
    public async Task Update_ConfirmsACustomExtra_ButIgnoresAnUnknownId()
    {
        var f = BuildFixture();
        var db = MockFor(f);

        await Endpoint(db).HandleAsync(Request(f, OutgoingShipmentState.Created, confirmExtra: true), CancellationToken.None);
        f.CustomExtra.IsShipmentLoadingConfirmed.Should().BeTrue();

        var g = BuildFixture();
        var unknown = Request(g, OutgoingShipmentState.Created);
        unknown.Data.ClientOrderShipments[0].CustomExtraItems = [new ExtraItemInfoDto { Id = Guid.NewGuid(), IsLoadingConfirmed = true }];

        var act = async () => await Endpoint(MockFor(g)).HandleAsync(unknown, CancellationToken.None);

        await act.Should().NotThrowAsync();
        g.Order.CustomExtraItems.Should().ContainSingle("the shipment confirms extras, it does not author them");
        g.CustomExtra.IsShipmentLoadingConfirmed.Should().BeFalse();
    }

    [Fact]
    public async Task GetDetail_CarriesTheSourceAndWhatIsOnHand()
    {
        var f = BuildFixture(ordered: 20, stockQuantity: 30);
        f.Item.QuantityFromInventory = 5;
        f.Item.InventoryItem = f.Stock;
        f.Item.InventoryItemId = f.Stock.Id;

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(MockFor(f).Object);
        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = f.Shipment.PublicId }, CancellationToken.None);

        var row = endpoint.Response.Stops.Single(s => s.OrderId == f.Order.PublicId).Products.Should().ContainSingle().Subject;
        row.Quantity.Should().Be(20);
        row.QuantityFromInventory.Should().Be(5);
        row.InventoryItemName.Should().Be("Sud 50 l");
        row.InventoryItemAvailable.Should().Be(30, "the nakládka needs it to warn about over-drawing");
    }
}
