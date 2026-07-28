using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// When a shipment's content may still change, and which state transitions are legal.
/// </summary>
/// <remarks>
/// Deliberately distinct from <see cref="PurchaseInvoiceSplit.IsEditable"/> and
/// <see cref="ShipmentInvoiceGraph.IsEditable"/>, which answer a different question.
/// Those govern loading progress and invoice assignment, both of which stay adjustable
/// until delivery. This type governs <em>content</em> — what is on the truck — which
/// freezes when the truck is packed.
/// </remarks>
public static class ShipmentMutability
{
    /// <summary>
    /// Content — stops, orders, vehicle, via points, stock purchases — may only change
    /// while the shipment is still being planned.
    /// </summary>
    public static bool IsContentEditable(OutgoingShipmentState state) =>
        state == OutgoingShipmentState.Created;

    /// <summary>
    /// Whether the shipment may move from <paramref name="from"/> to <paramref name="to"/>.
    /// </summary>
    /// <remarks>
    /// Single-step in both directions, mirroring the UI's own one-step forward and revert
    /// maps in <c>ShipmentDetail.tsx</c>. Staying in the same state is always allowed,
    /// because every content save re-sends the current state.
    ///
    /// <see cref="OutgoingShipmentState.Delivered"/> is terminal: reverting out of it
    /// re-ran the order transitions and freed already-delivered orders back to
    /// <see cref="OrderState.New"/>, silently unwinding an invoiced, reported run.
    /// <see cref="OutgoingShipmentState.Cancelled"/> restores to
    /// <see cref="OutgoingShipmentState.Created"/> only, which is the shipped restore
    /// affordance.
    /// </remarks>
    public static bool IsTransitionAllowed(OutgoingShipmentState from, OutgoingShipmentState to)
    {
        if (from == to)
            return true;

        return from switch
        {
            OutgoingShipmentState.Created => to is OutgoingShipmentState.Loaded
                or OutgoingShipmentState.Cancelled,
            OutgoingShipmentState.Loaded => to is OutgoingShipmentState.Created
                or OutgoingShipmentState.InTransit
                or OutgoingShipmentState.Cancelled,
            OutgoingShipmentState.InTransit => to is OutgoingShipmentState.Loaded
                or OutgoingShipmentState.Delivered
                or OutgoingShipmentState.Cancelled,
            OutgoingShipmentState.Delivered => false,
            OutgoingShipmentState.Cancelled => to is OutgoingShipmentState.Created,
            _ => false
        };
    }
}
