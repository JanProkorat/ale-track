using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Commands.MoveInvoiceLine;

/// <summary>
/// Moves a number of pieces of one shipment item from one invoice to another.
/// </summary>
/// <remarks>
/// The item is addressed by kind + public ID rather than by invoice-line ID because the UI shows
/// one row per product and a product can reach an invoice from several sources at once (the
/// client's own order, another client's order, our stock). The caller has to say which of those
/// the pieces come off, and the quantity is capped against that source alone — not against the
/// row total.
/// </remarks>
public sealed record MoveInvoiceLineDto
{
    /// <summary>
    /// Public ID of the invoice the pieces are taken from.
    /// </summary>
    public Guid FromInvoiceId { get; set; }

    /// <summary>
    /// Which kind of shipment item is being moved.
    /// </summary>
    public InvoiceLineSourceKind SourceKind { get; set; }

    /// <summary>
    /// Public ID of the item being moved — an order item, client extra item, or custom extra item
    /// depending on <see cref="SourceKind"/>.
    /// </summary>
    public Guid SourceItemId { get; set; }

    /// <summary>
    /// Number of pieces to move. Must not exceed what the source contributes to the origin invoice.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Public ID of the target invoice. Mutually exclusive with <see cref="ToClientId"/>.
    /// </summary>
    public Guid? ToInvoiceId { get; set; }

    /// <summary>
    /// Public ID of a client to open a new invoice for and move the pieces onto. Mutually
    /// exclusive with <see cref="ToInvoiceId"/>.
    /// </summary>
    public Guid? ToClientId { get; set; }
}
