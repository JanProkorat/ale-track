using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Features.OutgoingShipments.Queries.Invoices;

/// <summary>
/// How an outgoing shipment's items are split across invoices.
/// </summary>
public sealed record ShipmentInvoicesDto
{
    /// <summary>
    /// Invoices of the shipment, ordered by the client's position on the route, then by sequence.
    /// </summary>
    public List<ShipmentInvoiceDto> Invoices { get; set; } = [];

    /// <summary>
    /// Pieces deliberately kept off every invoice — delivered, not billed. The UI groups them
    /// under the client who ordered them and labels them <em>soukromé</em>.
    /// </summary>
    public List<ShipmentInvoiceLineDto> PrivateLines { get; set; } = [];

    /// <summary>
    /// Changes reconciliation had to make to an existing split because the shipment's contents
    /// moved underneath it. Empty in the normal case; the UI shows these as a banner.
    /// </summary>
    public List<InvoiceAdjustmentDto> Adjustments { get; set; } = [];

    /// <summary>
    /// Rows the office has confirmed as finished, with the numbers they were confirmed under. A
    /// client that was never marked is simply absent — read that as unready, with no number yet.
    /// </summary>
    public List<ShipmentInvoiceConfirmationDto> Confirmations { get; set; } = [];

    /// <summary>
    /// Whether the split may still be edited (false once the shipment is delivered or cancelled).
    /// </summary>
    public bool IsEditable { get; set; }
}

/// <summary>
/// One client's row of the split, marked finished and numbered.
/// </summary>
/// <remarks>
/// Its own list rather than a field on <see cref="ShipmentInvoiceDto"/>: readiness belongs to the
/// client's row, and repeating it on each of a client's invoices would invite the copies to
/// disagree.
/// </remarks>
public sealed record ShipmentInvoiceConfirmationDto
{
    /// <summary>Public ID of the client whose row this is.</summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Number the export prints the row under, from 1 per shipment. Kept when the row is
    /// un-marked, so re-marking gives the same number back.
    /// </summary>
    public int Number { get; set; }

    /// <summary>Whether the row is currently marked finished.</summary>
    public bool IsReady { get; set; }

    /// <summary>
    /// When an export last carried this row, or null while none has — what the export drawer reads
    /// to preselect the rows that have not gone out yet.
    /// </summary>
    public DateTime? LastExportedAt { get; set; }
}

/// <summary>
/// One invoice of an outgoing shipment.
/// </summary>
public sealed record ShipmentInvoiceDto
{
    /// <summary>Public ID of the invoice.</summary>
    public Guid Id { get; set; }

    /// <summary>Public ID of the client this invoice is issued to — the payer.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Name of the client this invoice is issued to.</summary>
    public string ClientName { get; set; } = null!;

    /// <summary>
    /// The client's trading name, when it has one — what tells two clients of the same name apart.
    /// </summary>
    public string? ClientBusinessName { get; set; }

    /// <summary>
    /// Official (billing) address of the client this invoice is issued to, when it has one — the
    /// client may have none, e.g. when it only ever pays for others' goods.
    /// </summary>
    public AddressDto? ClientOfficialAddress { get; set; }

    /// <summary>
    /// Position among that client's invoices on this shipment, starting at 1. Ordering only —
    /// not an invoice number.
    /// </summary>
    public int Sequence { get; set; }

    /// <summary>
    /// Position of the client's stop on the route, or null when the client has no stop and only
    /// holds cross-billed lines.
    /// </summary>
    public int? StopOrder { get; set; }

    /// <summary>Lines of this invoice.</summary>
    public List<ShipmentInvoiceLineDto> Lines { get; set; } = [];

    /// <summary>
    /// Sub-clients the payer should raise its own invoices against, chosen by the office. Empty
    /// unless someone picked any.
    /// </summary>
    public List<ShipmentInvoiceBillingRecipientDto> BillingRecipients { get; set; } = [];
}

/// <summary>
/// A sub-client named on a payer's invoice, with the address to invoice.
/// </summary>
public sealed record ShipmentInvoiceBillingRecipientDto
{
    /// <summary>Public ID of the sub-client.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Name of the sub-client.</summary>
    public string ClientName { get; set; } = null!;

    /// <summary>
    /// The sub-client's official address as recorded on this invoice — live while the shipment's
    /// invoicing is still editable, frozen afterwards.
    /// </summary>
    public AddressDto Address { get; set; } = null!;
}

/// <summary>
/// A quantity of one shipment item billed on an invoice.
/// </summary>
public sealed record ShipmentInvoiceLineDto
{
    /// <summary>Public ID of the line.</summary>
    public Guid Id { get; set; }

    /// <summary>Which kind of shipment item this line bills for.</summary>
    public InvoiceLineSourceKind SourceKind { get; set; }

    /// <summary>
    /// Public ID of the billed item — an order item, a client extra item, or a custom extra item
    /// depending on <see cref="SourceKind"/>. This is what a move request addresses.
    /// </summary>
    public Guid SourceItemId { get; set; }

    /// <summary>Public ID of the product, when the item has one.</summary>
    public Guid? ProductId { get; set; }

    /// <summary>Display name of the billed item.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Kind of the product, when the item has one.</summary>
    public ProductKind? Kind { get; set; }

    /// <summary>Package size of the product, when the item has one.</summary>
    public double? PackageSize { get; set; }

    /// <summary>Unit price including VAT, when the item has a product.</summary>
    public decimal? PriceWithVat { get; set; }

    /// <summary>Number of pieces billed on this line.</summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Public ID of the client who ordered these pieces. Differs from the invoice's client
    /// exactly when the line is cross-billed.
    /// </summary>
    public Guid OrderingClientId { get; set; }

    /// <summary>Name of the client who ordered these pieces.</summary>
    public string OrderingClientName { get; set; } = null!;

    /// <summary>
    /// Whether these pieces came out of our own warehouse rather than from the brewery.
    /// </summary>
    public bool IsFromStock { get; set; }
}

/// <summary>
/// One change reconciliation made to an existing split.
/// </summary>
public sealed record InvoiceAdjustmentDto
{
    /// <summary>What kind of change this was.</summary>
    public InvoiceAdjustmentKind Kind { get; set; }

    /// <summary>Which kind of shipment item it concerned.</summary>
    public InvoiceLineSourceKind SourceKind { get; set; }

    /// <summary>Display name of the affected item, when it could be resolved.</summary>
    public string? ItemName { get; set; }

    /// <summary>Number of pieces added, removed, or dropped.</summary>
    public int Quantity { get; set; }
}
