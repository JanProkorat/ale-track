using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// A shipment's full invoice split: its invoices (reached through the shipment) together with
/// the lines that belong to no invoice at all.
/// </summary>
/// <remarks>
/// Private lines cannot be reached from the shipment through a navigation — see
/// <c>OutgoingShipmentInvoiceLineConfiguration</c> — so they travel alongside it in this carrier.
/// Every invoicing endpoint loads one and passes it to reconciliation and mapping, which keeps
/// "the split" a single thing rather than two values that can drift apart.
///
/// Both collections are mutated in place by reconciliation and by the move endpoint.
/// </remarks>
public sealed record ShipmentInvoiceSplit
{
    /// <summary>
    /// The shipment, with stops, orders, items, extras and invoices loaded.
    /// </summary>
    public required OutgoingShipment Shipment { get; init; }

    /// <summary>
    /// Lines whose pieces are deliberately excluded from every invoice — delivered, not billed.
    /// </summary>
    public required List<OutgoingShipmentInvoiceLine> PrivateLines { get; init; }

    /// <summary>
    /// Wraps a shipment whose private lines are known to be empty — first materialisation and
    /// unit tests.
    /// </summary>
    public static ShipmentInvoiceSplit Of(OutgoingShipment shipment) =>
        new() { Shipment = shipment, PrivateLines = [] };
}
