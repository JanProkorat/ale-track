using AleTrack.Common.Utils;
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
    /// Recorded deviations of the orders on this run — what actually came off the van.
    /// </summary>
    /// <remarks>
    /// Travels with the split for the same reason the private lines do: they cannot be reached
    /// from the shipment through a navigation, and the invoice is wrong without them. An invoice
    /// bills what was handed over, not what was planned.
    /// </remarks>
    public List<ClientLedgerEntry> LedgerEntries { get; init; } = [];

    /// <summary>
    /// Price overrides of the run's ordering clients, keyed by client id.
    /// </summary>
    /// <remarks>
    /// Needed only for a product taken at the door: it has no order line and no stop item, so
    /// there is no snapshot to read a price off and the client's own price list is the only place
    /// left to ask. Billing the catalog price instead has already been a defect here once.
    /// </remarks>
    public Dictionary<long, ClientPriceList> PriceListsByClientId { get; init; } = [];

    /// <summary>
    /// Wraps a shipment whose private lines are known to be empty — first materialisation and
    /// unit tests.
    /// </summary>
    public static ShipmentInvoiceSplit Of(OutgoingShipment shipment) =>
        new() { Shipment = shipment, PrivateLines = [] };
}
