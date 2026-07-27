using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderDeliveryAddressPropagationTests
{
    private static readonly DateTime Now = new(2026, 7, 27, 10, 0, 0, DateTimeKind.Utc);

    /// Builds an order already planned onto a stop of a shipment in the given
    /// state, with the order's address deliberately ahead of the stop's.
    private static (Order Order, OutgoingShipmentStop Stop, OutgoingShipment Shipment) Planned(
        OutgoingShipmentState shipmentState,
        bool overridden)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(client: client);
        order.DeliveryAddressKind = DeliveryAddressKind.Contact;

        var shipment = new OutgoingShipment { PublicId = Guid.NewGuid(), State = shipmentState };
        var stop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            OutgoingShipment = shipment,
            SelectedAddressKind = DeliveryAddressKind.Official,
            IsAddressOverridden = overridden
        };
        shipment.Stops.Add(stop);
        order.OutgoingShipmentStop = stop;

        return (order, stop, shipment);
    }

    [Fact]
    public async Task Propagate_InheritedStop_FollowsTheOrderAndIsStamped()
    {
        var (order, stop, shipment) = Planned(OutgoingShipmentState.Created, overridden: false);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order], outgoingShipments: [shipment]);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(db.Object, order, Now, CancellationToken.None);

        stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Contact);
        stop.ClientDeliveryPlaceId.Should().Be(order.ClientDeliveryPlaceId);
        stop.AddressChangedAt.Should().Be(Now);
    }

    // The planner's override wins, but the divergence is announced — that is
    // the warning nobody would otherwise notice.
    [Fact]
    public async Task Propagate_OverriddenStop_KeepsItsAddressButIsStamped()
    {
        var (order, stop, shipment) = Planned(OutgoingShipmentState.Created, overridden: true);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order], outgoingShipments: [shipment]);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(db.Object, order, Now, CancellationToken.None);

        stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Official);
        stop.AddressChangedAt.Should().Be(Now);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task Propagate_ClosedShipment_IsUntouched(OutgoingShipmentState state)
    {
        var (order, stop, shipment) = Planned(state, overridden: false);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order], outgoingShipments: [shipment]);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(db.Object, order, Now, CancellationToken.None);

        stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Official);
        stop.AddressChangedAt.Should().BeNull();
    }

    [Fact]
    public async Task Propagate_OrderOnNoShipment_DoesNothing()
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(client: client);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        var act = () => OrderDeliveryAddressWriter.PropagateToStopAsync(
            db.Object, order, Now, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }
}
