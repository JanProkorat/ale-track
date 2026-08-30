using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Client = AleTrack.Entities.Client;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The two flags the screens gate on once filing exists: whether the run's invoicing is filed, and
/// whether the order may still be edited the ordinary way.
/// </summary>
/// <remarks>
/// Both are read off the wire rather than derived in the browser, and the second is computed by
/// the same <c>OrderMutability</c> the update endpoint enforces — so a screen can neither offer an
/// edit the server will refuse, nor refuse one it would allow.
///
/// The filed flag is read on two screens, like readiness beside it, and EF cannot share a
/// predicate between two projections. Hence both endpoints in every case.
/// </remarks>
public sealed class InvoicingFiledProjectionTests
{
    private const long ClientRowId = 92;

    private static readonly DateTime Filed = new(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc);

    private sealed record Fixture(OutgoingShipment Shipment, Order Order, Client Client);

    private static Fixture Build(OutgoingShipmentState state, DateTime? filedAt)
    {
        var client = ClientBuilder.BuildEntity(
            publicId: Guid.NewGuid(), name: "Hospoda Sama", officialAddress: AddressBuilder.BuildEntity());
        client.Id = ClientRowId;

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);
        order.ClientId = client.Id;

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            state: state,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        shipment.InvoicingFiledAt = filedAt;

        // Both ends of the stop link: the mocked context does no navigation fixup, and the order
        // screen reaches the run through stop.OutgoingShipment.
        var stop = shipment.Stops.First();
        stop.OutgoingShipment = shipment;
        order.OutgoingShipmentStop = stop;

        return new Fixture(shipment, order, client);
    }

    private static async Task<OrderDto> OnOrderDetailAsync(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            orders: [f.Order],
            outgoingShipments: [f.Shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = f.Order.PublicId }, CancellationToken.None);
        return endpoint.Response;
    }

    private static async Task<bool> OnShipmentDetailAsync(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            orders: [f.Order],
            outgoingShipments: [f.Shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = f.Shipment.PublicId }, CancellationToken.None);
        return endpoint.Response.IsInvoicingFiled;
    }

    /// <summary>
    /// The state that used to freeze an order and now does not. This is the case the whole change
    /// is about: the van is packed, the paperwork is not filed, the plan is still correctable.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Created)]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    public async Task Unfiled_LeavesTheOrderEditableAndOffersNoRecording(OutgoingShipmentState state)
    {
        var f = Build(state, filedAt: null);

        var order = await OnOrderDetailAsync(f);

        order.IsInvoicingFiled.Should().BeFalse();
        order.IsContentEditable.Should().BeTrue();
        (await OnShipmentDetailAsync(f)).Should().BeFalse();
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Created)]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    [InlineData(OutgoingShipmentState.Delivered)]
    public async Task Filed_ClosesTheOrderAndOpensRecording(OutgoingShipmentState state)
    {
        var f = Build(state, filedAt: Filed);

        var order = await OnOrderDetailAsync(f);

        order.IsInvoicingFiled.Should().BeTrue();
        order.IsContentEditable.Should().BeFalse();
        (await OnShipmentDetailAsync(f)).Should().BeTrue();
    }

    /// <summary>
    /// A finished run closes its orders whether or not anybody filed the paperwork — but it opens
    /// no recording either, which is why filing a delivered run stays possible.
    /// </summary>
    [Fact]
    public async Task DeliveredButUnfiled_ClosesTheOrderWithoutOpeningRecording()
    {
        var f = Build(OutgoingShipmentState.Delivered, filedAt: null);

        var order = await OnOrderDetailAsync(f);

        order.IsContentEditable.Should().BeFalse();
        order.IsInvoicingFiled.Should().BeFalse();
    }

    /// <summary>
    /// A cancelled run's orders are freed for reuse: the run vanishes from the order screen
    /// altogether, so paperwork filed on it holds nothing.
    /// </summary>
    [Fact]
    public async Task FiledThenCancelled_FreesTheOrderAgain()
    {
        var f = Build(OutgoingShipmentState.Cancelled, filedAt: Filed);

        var order = await OnOrderDetailAsync(f);

        order.OutgoingShipment.Should().BeNull();
        order.IsInvoicingFiled.Should().BeFalse();
        order.IsContentEditable.Should().BeTrue();
    }
}
