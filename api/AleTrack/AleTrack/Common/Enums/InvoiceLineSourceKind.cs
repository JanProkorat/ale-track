namespace AleTrack.Common.Enums;

/// <summary>
/// Kind of the shipment item an invoice line bills for.
/// </summary>
/// <remarks>
/// Inventory extra items are deliberately absent — those goods come back to our own
/// inventory and are never invoiced to a client.
/// </remarks>
public enum InvoiceLineSourceKind
{
    /// <summary>An item of a client order delivered on this shipment.</summary>
    OrderItem = 0,

    /// <summary>
    /// An item the client wants that no brewery supplies. Value 2 is kept so stored
    /// lines survive; 1 used to mean an inventory dokládka, which is no longer a
    /// billable source of its own — those pieces are billed as part of the order item
    /// they fulfil.
    /// </summary>
    CustomExtraItem = 2,

    /// <summary>
    /// A line of a client order that buys off a supplier's price list — a CO₂ refill, a crate.
    /// The client ordered it, so it is billed like anything else they ordered.
    /// </summary>
    SupplierGoodItem = 3,

    /// <summary>
    /// A product the client took at the door, recorded as a deviation rather than ordered.
    /// </summary>
    /// <remarks>
    /// It has no order line to bill through — nobody planned it — so the ledger entry is the
    /// billable source itself. Of all the ways this feature could go wrong, not billing goods the
    /// client walked away with is the most expensive.
    /// </remarks>
    LedgerEntry = 4
}
