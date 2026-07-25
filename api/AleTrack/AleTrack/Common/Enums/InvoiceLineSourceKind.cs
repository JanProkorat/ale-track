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

    /// <summary>An extra item taken from the inventory and delivered to a client (dokládka).</summary>
    ClientExtraItem = 1,

    /// <summary>A free-form extra item delivered to a client.</summary>
    CustomExtraItem = 2
}
