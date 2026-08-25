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
    /// Frozen once the order itself is closed, once its run is finished, or once that run's
    /// invoicing has been filed.
    /// </summary>
    /// <remarks>
    /// Filing is what closes an order, not packing the van. An order legitimately changes while
    /// the run is loaded and while it is on the road — a client rings up, a pallet will not fit,
    /// the office spots a wrong line — and none of that is a deviation to be recorded beside the
    /// plan; it is the plan being corrected. What cannot be corrected is paperwork already filed,
    /// which is why <see cref="OutgoingShipment.InvoicingFiledAt"/> is the gate and the run's
    /// state is not.
    ///
    /// <see cref="OutgoingShipmentState.Delivered"/> still freezes: the run is over, there is
    /// nothing left to correct, and it is also where the ledger settles what the next order
    /// promised to carry.
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

        var shipment = order.OutgoingShipmentStop?.OutgoingShipment;

        if (shipment is null)
            return true;

        // Cancellation outranks filing, for the reason above: the orders of a cancelled run are
        // freed for reuse, and paperwork filed on a run that then did not happen must not hold
        // them.
        if (shipment.State is OutgoingShipmentState.Cancelled)
            return true;

        return shipment.State != OutgoingShipmentState.Delivered && !shipment.IsInvoicingFiled;
    }
}
