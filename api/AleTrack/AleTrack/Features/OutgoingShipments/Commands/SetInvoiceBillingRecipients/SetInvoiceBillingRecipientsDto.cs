namespace AleTrack.Features.OutgoingShipments.Commands.SetInvoiceBillingRecipients;

/// <summary>
/// The full set of sub-clients to name on one invoice as addresses its payer should invoice.
/// </summary>
/// <remarks>
/// A replacement, not a delta: whatever the invoice currently names is dropped in favour of this
/// list, so an empty list clears the selection. The UI edits it as one multi-select, which is the
/// same shape.
/// </remarks>
public sealed record SetInvoiceBillingRecipientsDto
{
    /// <summary>
    /// Public IDs of the sub-clients to name. Each must be billed through this invoice's payer and
    /// must have an official address.
    /// </summary>
    public List<Guid> ClientIds { get; set; } = [];
}
