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

    /// <summary>
    /// Packing the van no longer closes an order. A client rings up, a pallet will not fit, the
    /// office spots a wrong line — that is the plan being corrected, not a deviation to be
    /// recorded beside it, and it happens while the run is loaded and on the road.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, true)]
    [InlineData(OutgoingShipmentState.InTransit, true)]
    // The run is over: nothing left to correct, and this is where the ledger settles what the
    // next order promised to carry.
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
    /// Filing the run's invoicing is what closes its orders — the one-way door between correcting
    /// the plan and recording deviations beside it.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Created)]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    public void IsContentEditable_FiledInvoicing_FreezesTheOrderInEveryState(OutgoingShipmentState shipmentState)
    {
        var order = new Order
        {
            State = OrderState.Planning,
            OutgoingShipmentStop = new OutgoingShipmentStop
            {
                OutgoingShipment = new OutgoingShipment
                {
                    State = shipmentState,
                    InvoicingFiledAt = new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc)
                }
            }
        };

        OrderMutability.IsContentEditable(order).Should().BeFalse();
    }

    /// <summary>
    /// A cancelled run's orders are freed for reuse, and filing cannot hold them: the run they
    /// were filed on no longer exists as far as the order is concerned.
    /// </summary>
    [Fact]
    public void IsContentEditable_FiledButCancelled_StaysEditable()
    {
        var order = new Order
        {
            State = OrderState.Planning,
            OutgoingShipmentStop = new OutgoingShipmentStop
            {
                OutgoingShipment = new OutgoingShipment
                {
                    State = OutgoingShipmentState.Cancelled,
                    InvoicingFiledAt = new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc)
                }
            }
        };

        OrderMutability.IsContentEditable(order).Should().BeTrue();
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
