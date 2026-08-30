namespace AleTrack.Common.Enums;

/// <summary>
/// What an order line is for: the goods, the money, or both.
/// </summary>
/// <remarks>
/// A line has two sides that are normally inseparable — pieces that travel on the run, and money
/// on the invoice. Settling an earlier handover needs them apart:
///
/// <list type="bullet">
/// <item><see cref="BillOnly"/> — the client already has the pieces (taken at the door on an
/// earlier delivery), so only the money is outstanding.</item>
/// <item><see cref="Private"/> — the money is already settled (billed on an earlier delivery, or
/// paid outside the invoice), so only the pieces are outstanding.</item>
/// </list>
///
/// The fourth combination — neither goods nor money — is not a line, so it has no member here.
/// </remarks>
public enum OrderLineKind
{
    /// <summary>Goods and money both. Every ordinary line.</summary>
    Normal = 0,

    /// <summary>
    /// Money only: billed, never loaded. Absent from the nakládka and the vykládka, present on
    /// the invoice.
    /// </summary>
    BillOnly = 1,

    /// <summary>
    /// Goods only: loaded and unloaded like anything else, but excluded from every invoice — the
    /// same meaning <see cref="Entities.OutgoingShipmentInvoiceLine.IsPrivate"/> already carries,
    /// declared by the order rather than decided in the run's invoicing.
    /// </summary>
    Private = 2
}
