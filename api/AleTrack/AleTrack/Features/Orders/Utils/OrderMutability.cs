using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// When an order's content — its items, client, address and delivery outcome — may still
/// change.
/// </summary>
public static class OrderMutability
{
    /// <summary>
    /// Frozen once the order itself is closed, or once the shipment carrying it has been
    /// packed.
    /// </summary>
    /// <remarks>
    /// Mirrors <c>ShipmentMutability.IsContentEditable</c>, because order items <em>are</em>
    /// the shipment's content. Guarding only the order's own terminal states would leave a
    /// back door through the order screen straight into a packed shipment.
    ///
    /// <see cref="OutgoingShipmentState.Cancelled"/> is deliberately excluded: cancelling a
    /// run frees its orders back to <see cref="OrderState.New"/> for reuse, but the stop link
    /// survives the cancellation, so treating Cancelled as frozen would strand every freed
    /// order.
    /// </remarks>
    public static bool IsContentEditable(Order order)
    {
        if (order.State is OrderState.Finished or OrderState.Cancelled)
            return false;

        var shipmentState = order.OutgoingShipmentStop?.OutgoingShipment?.State;

        return shipmentState is not (OutgoingShipmentState.Loaded
            or OutgoingShipmentState.InTransit
            or OutgoingShipmentState.Delivered);
    }
}
