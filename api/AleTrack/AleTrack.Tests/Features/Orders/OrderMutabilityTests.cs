using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderMutabilityTests
{
    [Theory]
    [InlineData(OrderState.New, true)]
    [InlineData(OrderState.Planning, true)]
    [InlineData(OrderState.Delivering, true)]
    [InlineData(OrderState.Finished, false)]
    [InlineData(OrderState.Cancelled, false)]
    public void IsContentEditable_FollowsOrderState_WhenNotOnAShipment(OrderState state, bool expected)
    {
        var order = new Order { State = state };

        OrderMutability.IsContentEditable(order).Should().Be(expected);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Delivered, false)]
    // A cancelled run frees its orders for reuse but the stop link survives, so a freed
    // order must stay editable.
    [InlineData(OutgoingShipmentState.Cancelled, true)]
    public void IsContentEditable_FollowsShipmentState(OutgoingShipmentState shipmentState, bool expected)
    {
        var order = new Order
        {
            State = OrderState.Planning,
            OutgoingShipmentStop = new OutgoingShipmentStop
            {
                OutgoingShipment = new OutgoingShipment { State = shipmentState }
            }
        };

        OrderMutability.IsContentEditable(order).Should().Be(expected);
    }

    /// <summary>
    /// The order's own closed state wins: a Finished order stays frozen even though the
    /// cancelled shipment it hangs off would otherwise free it.
    /// </summary>
    [Fact]
    public void IsContentEditable_FinishedOrderOnCancelledShipment_IsFrozen()
    {
        var order = new Order
        {
            State = OrderState.Finished,
            OutgoingShipmentStop = new OutgoingShipmentStop
            {
                OutgoingShipment = new OutgoingShipment { State = OutgoingShipmentState.Cancelled }
            }
        };

        OrderMutability.IsContentEditable(order).Should().BeFalse();
    }
}
